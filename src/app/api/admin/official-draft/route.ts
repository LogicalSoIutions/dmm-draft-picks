import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";
import { validateCaptainAssignments, validatePickOrder } from "@/lib/draft";
import {
  findDraftsMatchingPayload,
  getOfficialDraft,
  upsertOfficialDraft,
  type OfficialDraftMatch,
  type OfficialDraftRecord,
} from "@/server/db/queries";

type MatchView = {
  publicId: string;
  kickUsername: string;
  updatedAt: string;
};

type OfficialDraftView = {
  picksOrder: string[];
  captainAssignments: OfficialDraftRecord["captainAssignments"];
  updatedAt: string;
};

const toMatchView = (match: OfficialDraftMatch): MatchView => ({
  publicId: match.publicId,
  kickUsername: match.kickUsername,
  updatedAt: match.updatedAt,
});

const toOfficialDraftView = (
  record: OfficialDraftRecord,
): OfficialDraftView => ({
  picksOrder: record.picksOrder,
  captainAssignments: record.captainAssignments,
  updatedAt: record.updatedAt,
});

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
      response: NextResponse.json(
        { error: "Not authorized" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: user.userId };
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  const official = getOfficialDraft();
  const matches = official
    ? findDraftsMatchingPayload({
        picksOrder: official.picksOrder,
        captainAssignments: official.captainAssignments,
      }).map(toMatchView)
    : [];
  return NextResponse.json({
    official: official ? toOfficialDraftView(official) : null,
    matches,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }
  let order: unknown;
  let captainAssignments: unknown;
  try {
    const body = (await request.json()) as {
      order?: unknown;
      captainAssignments?: unknown;
    };
    order = body.order;
    captainAssignments = body.captainAssignments;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const validation = validatePickOrder(order);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  const assignmentValidation = validateCaptainAssignments(
    captainAssignments,
    validation.order,
  );
  if (!assignmentValidation.valid) {
    return NextResponse.json(
      { error: assignmentValidation.message },
      { status: 400 },
    );
  }
  const saved = upsertOfficialDraft({
    picksOrder: validation.order,
    captainAssignments: assignmentValidation.assignments,
    setByUserId: auth.userId,
  });
  const matches = findDraftsMatchingPayload({
    picksOrder: saved.picksOrder,
    captainAssignments: saved.captainAssignments,
  }).map(toMatchView);
  return NextResponse.json({
    message: "Official draft saved",
    official: toOfficialDraftView(saved),
    matches,
  });
}
