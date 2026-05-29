import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { isBingoTilePoolReady, validateCardLayout } from "@/lib/bingo";
import { isBingoSubmissionOpen } from "@/lib/bingo-deadline";
import { getBingoOptions, upsertBingoCard } from "@/server/db/queries";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isBingoSubmissionOpen()) {
    return NextResponse.json(
      { error: "Bingo cards are locked." },
      { status: 403 },
    );
  }
  const options = getBingoOptions();
  if (!options) {
    return NextResponse.json(
      { error: "Bingo tiles have not been set yet." },
      { status: 409 },
    );
  }
  const readiness = isBingoTilePoolReady(options.tiles);
  if (!readiness.ready) {
    return NextResponse.json({ error: readiness.message }, { status: 409 });
  }
  let layout: unknown;
  try {
    const body = (await request.json()) as { layout?: unknown };
    layout = body.layout;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const validation = validateCardLayout(layout, options.tiles);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  upsertBingoCard({ ownerUserId: user.userId, layout: validation.layout });
  return NextResponse.json({ message: "Bingo card saved" });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Load your bingo card from /bingo" },
    { status: 400 },
  );
}
