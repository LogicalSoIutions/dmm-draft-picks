import { NextRequest, NextResponse } from "next/server";

import { isAdminUsername } from "@/lib/admin";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { hasBingo, validateCompletedTileIds } from "@/lib/bingo";
import {
  getBingoOptions,
  getBingoProgress,
  listAllBingoCardsWithOwner,
  upsertBingoProgress,
} from "@/server/db/queries";

type WinnerView = {
  kickUsername: string;
  updatedAt: string;
};

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

const buildWinners = (completedTileIds: string[]): WinnerView[] => {
  const completed = new Set(completedTileIds);
  return listAllBingoCardsWithOwner()
    .filter((card) => hasBingo(card.layout, completed))
    .map((card) => ({
      kickUsername: card.ownerKickUsername,
      updatedAt: card.updatedAt,
    }));
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  const options = getBingoOptions();
  if (!options) {
    return NextResponse.json(
      { error: "Bingo tiles have not been set yet." },
      { status: 409 },
    );
  }
  const tileIdSet = new Set(options.tiles.map((tile) => tile.id));
  const progress = getBingoProgress();
  const completedTileIds = (progress?.completedTileIds ?? []).filter((tileId) =>
    tileIdSet.has(tileId),
  );
  return NextResponse.json({
    completedTileIds,
    winners: buildWinners(completedTileIds),
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  const options = getBingoOptions();
  if (!options) {
    return NextResponse.json(
      { error: "Bingo tiles have not been set yet." },
      { status: 409 },
    );
  }
  let tileId: unknown;
  let completed: unknown;
  try {
    const body = (await request.json()) as {
      tileId?: unknown;
      completed?: unknown;
    };
    tileId = body.tileId;
    completed = body.completed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  if (typeof tileId !== "string" || tileId.trim().length === 0) {
    return NextResponse.json({ error: "tileId is required" }, { status: 400 });
  }
  if (typeof completed !== "boolean") {
    return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 });
  }
  const tileIdSet = new Set(options.tiles.map((tile) => tile.id));
  if (!tileIdSet.has(tileId)) {
    return NextResponse.json({ error: `Unknown tile id: ${tileId}` }, { status: 400 });
  }
  const currentCompleted = new Set(getBingoProgress()?.completedTileIds ?? []);
  if (completed) {
    currentCompleted.add(tileId);
  } else {
    currentCompleted.delete(tileId);
  }
  const validation = validateCompletedTileIds(
    Array.from(currentCompleted),
    options.tiles,
  );
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  const saved = upsertBingoProgress({
    completedTileIds: validation.completedTileIds,
    updatedByUserId: auth.userId,
  });
  return NextResponse.json({
    completedTileIds: saved.completedTileIds,
    winners: buildWinners(saved.completedTileIds),
  });
}
