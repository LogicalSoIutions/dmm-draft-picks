import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import {
  authorizeDraftAccess,
  validateCaptainAssignments,
  validatePickOrder,
} from "@/lib/draft";
import { getDraftByPublicId, updateDraftOrder } from "@/server/db/queries";

const getDraftForRequest = async (
  request: NextRequest,
  publicId: string,
): Promise<
  | { ok: true; draft: NonNullable<ReturnType<typeof getDraftByPublicId>>; editKey: string }
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
  const editKey = request.nextUrl.searchParams.get("editKey");
  if (!editKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing editKey" }, { status: 400 }),
    };
  }
  const draft = getDraftByPublicId(publicId);
  if (!draft) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Draft not found" }, { status: 404 }),
    };
  }
  if (!authorizeDraftAccess({ draft, userId: user.userId, editKey })) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized for this draft edit URL" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, draft, editKey };
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
): Promise<NextResponse> {
  const { publicId } = await context.params;
  const auth = await getDraftForRequest(request, publicId);
  if (!auth.ok) {
    return auth.response;
  }
  return NextResponse.json({
    publicId: auth.draft.publicId,
    order: auth.draft.picksOrder,
    captainAssignments: auth.draft.captainAssignments,
    shareUrl: `/d/${auth.draft.publicId}`,
    updatedAt: auth.draft.updatedAt,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
): Promise<NextResponse> {
  const { publicId } = await context.params;
  const auth = await getDraftForRequest(request, publicId);
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
  const updated = updateDraftOrder({
    publicId,
    picksOrder: validation.order,
    captainAssignments: assignmentValidation.assignments,
  });
  if (!updated) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  return NextResponse.json({
    message: "Draft updated",
    publicId: updated.publicId,
    shareUrl: `/d/${updated.publicId}`,
    updatedAt: updated.updatedAt,
  });
}
