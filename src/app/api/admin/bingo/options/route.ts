import { NextRequest, NextResponse } from "next/server";

import { isAdminUsername } from "@/lib/admin";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { bingoTierOrder, validateTileOptions, type BingoTier } from "@/lib/bingo";
import {
  getBingoOptions,
  upsertBingoOptionsIfUnchanged,
} from "@/server/db/queries";

const requireAdmin = async (
  request: NextRequest,
): Promise<
  | { ok: true; userId: number }
  | { ok: false; response: NextResponse }
> => {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  if (!isAdminUsername(user.kickUsername)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.userId };
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  const options = getBingoOptions();
  return NextResponse.json({
    tiles: options?.tiles ?? null,
    updatedAt: options?.updatedAt ?? null,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  let tiles: unknown;
  let expectedUpdatedAt: unknown;
  try {
    const body = (await request.json()) as {
      tiles?: unknown;
      expectedUpdatedAt?: unknown;
    };
    tiles = body.tiles;
    expectedUpdatedAt = body.expectedUpdatedAt;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  if (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== "string") {
    return NextResponse.json(
      { error: "expectedUpdatedAt must be a string or null" },
      { status: 400 },
    );
  }
  const validation = validateTileOptions(tiles, { allowPartial: true });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  const saved = upsertBingoOptionsIfUnchanged({
    tiles: validation.tiles,
    setByUserId: auth.userId,
    expectedUpdatedAt,
  });
  if (!saved.ok) {
    return NextResponse.json(
      {
        error:
          "Bingo tiles were updated by another admin. Refresh before saving again.",
        tiles: saved.current?.tiles ?? null,
        updatedAt: saved.current?.updatedAt ?? null,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({
    message: "Bingo tiles saved",
    tiles: saved.record.tiles,
    updatedAt: saved.record.updatedAt,
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  let op: unknown;
  let tileId: unknown;
  let tile: unknown;
  let expectedUpdatedAt: unknown;
  try {
    const body = (await request.json()) as {
      op?: unknown;
      tileId?: unknown;
      tile?: unknown;
      expectedUpdatedAt?: unknown;
    };
    op = body.op;
    tileId = body.tileId;
    tile = body.tile;
    expectedUpdatedAt = body.expectedUpdatedAt;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  if (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== "string") {
    return NextResponse.json(
      { error: "expectedUpdatedAt must be a string or null" },
      { status: 400 },
    );
  }

  const currentTiles = getBingoOptions()?.tiles ?? [];
  let nextTiles = [...currentTiles];

  if (op === "upsert") {
    if (typeof tile !== "object" || tile === null) {
      return NextResponse.json({ error: "tile is required" }, { status: 400 });
    }
    const typedTile = tile as {
      id?: unknown;
      label?: unknown;
      tier?: unknown;
    };
    if (typeof typedTile.id !== "string" || typedTile.id.trim().length === 0) {
      return NextResponse.json({ error: "tile.id is required" }, { status: 400 });
    }
    if (
      typeof typedTile.label !== "string" ||
      typedTile.label.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "tile.label is required" },
        { status: 400 },
      );
    }
    if (
      typeof typedTile.tier !== "string" ||
      !bingoTierOrder.includes(typedTile.tier as (typeof bingoTierOrder)[number])
    ) {
      return NextResponse.json({ error: "tile.tier is invalid" }, { status: 400 });
    }
    const normalizedTier = typedTile.tier as BingoTier;
    const normalizedTile = {
      id: typedTile.id.trim(),
      label: typedTile.label.trim(),
      tier: normalizedTier,
    };
    const existingIndex = nextTiles.findIndex(
      (entry) => entry.id === normalizedTile.id,
    );
    if (existingIndex >= 0) {
      nextTiles[existingIndex] = normalizedTile;
    } else {
      nextTiles = [...nextTiles, normalizedTile];
    }
  } else if (op === "delete") {
    if (typeof tileId !== "string" || tileId.trim().length === 0) {
      return NextResponse.json({ error: "tileId is required" }, { status: 400 });
    }
    nextTiles = nextTiles.filter((entry) => entry.id !== tileId.trim());
  } else {
    return NextResponse.json(
      { error: "op must be either 'upsert' or 'delete'" },
      { status: 400 },
    );
  }

  const validation = validateTileOptions(nextTiles, { allowPartial: true });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  const saved = upsertBingoOptionsIfUnchanged({
    tiles: validation.tiles,
    setByUserId: auth.userId,
    expectedUpdatedAt,
  });
  if (!saved.ok) {
    return NextResponse.json(
      {
        error:
          "Bingo tiles were updated by another admin. Refresh before saving again.",
        tiles: saved.current?.tiles ?? null,
        updatedAt: saved.current?.updatedAt ?? null,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({
    message: "Bingo tile updated",
    tiles: saved.record.tiles,
    updatedAt: saved.record.updatedAt,
  });
}
