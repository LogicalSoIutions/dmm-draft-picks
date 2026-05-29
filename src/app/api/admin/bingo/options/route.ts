import { NextRequest, NextResponse } from "next/server";

import { isAdminUsername } from "@/lib/admin";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { validateTileOptions } from "@/lib/bingo";
import { getBingoOptions, upsertBingoOptions } from "@/server/db/queries";

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
  return NextResponse.json({ tiles: options?.tiles ?? null });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  let tiles: unknown;
  try {
    const body = (await request.json()) as { tiles?: unknown };
    tiles = body.tiles;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const validation = validateTileOptions(tiles, { allowPartial: true });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  const saved = upsertBingoOptions({
    tiles: validation.tiles,
    setByUserId: auth.userId,
  });
  return NextResponse.json({
    message: "Bingo tiles saved",
    tiles: saved.tiles,
  });
}
