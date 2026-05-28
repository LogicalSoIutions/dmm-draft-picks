import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { isNewDraftSubmissionOpen } from "@/lib/draft-deadline";
import {
  createDraftIds,
  validateCaptainAssignments,
  validatePickOrder,
} from "@/lib/draft";
import {
  createDraft,
  getDraftByOwnerUserId,
  updateDraftOrder,
} from "@/server/db/queries";

const parseDraftBody = async (
  request: NextRequest,
): Promise<{ order: unknown; captainAssignments: unknown }> => {
  const body = (await request.json()) as {
    order?: unknown;
    captainAssignments?: unknown;
  };
  return { order: body.order, captainAssignments: body.captainAssignments };
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  let order: unknown;
  let captainAssignments: unknown;
  try {
    const parsed = await parseDraftBody(request);
    order = parsed.order;
    captainAssignments = parsed.captainAssignments;
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
  const picksOrder = validation.order;
  const normalizedAssignments = assignmentValidation.assignments;
  const existingDraft = getDraftByOwnerUserId(user.userId);
  if (!existingDraft && !isNewDraftSubmissionOpen()) {
    return NextResponse.json(
      { error: "New draft submissions are closed." },
      { status: 403 },
    );
  }
  const ids = createDraftIds();
  if (existingDraft) {
    const updatedDraft = updateDraftOrder({
      publicId: existingDraft.publicId,
      picksOrder,
      captainAssignments: normalizedAssignments,
    });
    if (!updatedDraft) {
      return NextResponse.json(
        { error: "Failed to update existing draft" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        message: "Draft updated",
        publicId: updatedDraft.publicId,
        shareUrl: `/d/${updatedDraft.publicId}`,
      },
      { status: 200 },
    );
  }
  createDraft({
    publicId: ids.publicId,
    ownerUserId: user.userId,
    editKeyHash: ids.editKeyHash,
    picksOrder,
    captainAssignments: normalizedAssignments,
  });
  return NextResponse.json(
    {
      message: "Draft created",
      publicId: ids.publicId,
      editUrl: `/d/${ids.publicId}/${ids.editKey}`,
      shareUrl: `/d/${ids.publicId}`,
    },
    { status: 201 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Use /api/drafts/{publicId}?editKey=..." },
    { status: 400 },
  );
}
