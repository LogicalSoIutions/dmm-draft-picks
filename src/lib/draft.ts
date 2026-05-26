import {
  captainIdSet,
  defaultPickOrder,
  pickIdSet,
  type CaptainAssignments,
} from "@/data/participants";
import { randomId, safeEqual, sha256Hex } from "@/lib/crypto";
import { getSessionSecret } from "@/lib/env";
import type { DraftRecord } from "@/server/db/queries";

const expectedPickCount = defaultPickOrder.length;

export const hashEditKey = (editKey: string): string =>
  sha256Hex(`${editKey}:${getSessionSecret()}`);

export const createDraftIds = (): {
  publicId: string;
  editKey: string;
  editKeyHash: string;
} => {
  const publicId = randomId(9);
  const editKey = randomId(24);
  return {
    publicId,
    editKey,
    editKeyHash: hashEditKey(editKey),
  };
};

export const validatePickOrder = (order: unknown): {
  valid: true;
  order: string[];
} | {
  valid: false;
  message: string;
} => {
  if (!Array.isArray(order)) {
    return { valid: false, message: "Order must be an array" };
  }
  if (order.length !== expectedPickCount) {
    return {
      valid: false,
      message: `Order must contain exactly ${expectedPickCount} picks`,
    };
  }
  const seen = new Set<string>();
  for (const entry of order) {
    if (typeof entry !== "string") {
      return { valid: false, message: "Order entries must be strings" };
    }
    if (!pickIdSet.has(entry)) {
      return { valid: false, message: `Unknown pick id: ${entry}` };
    }
    if (seen.has(entry)) {
      return { valid: false, message: "Duplicate pick id detected" };
    }
    seen.add(entry);
  }
  return { valid: true, order };
};

export const validateCaptainAssignments = (
  assignments: unknown,
  order: string[],
): {
  valid: true;
  assignments: CaptainAssignments;
} | {
  valid: false;
  message: string;
} => {
  if (
    typeof assignments !== "object" ||
    assignments === null ||
    Array.isArray(assignments)
  ) {
    return { valid: false, message: "Captain assignments must be an object" };
  }
  const typedAssignments = assignments as Record<string, unknown>;
  for (const pickId of order) {
    const captainId = typedAssignments[pickId];
    if (typeof captainId !== "string") {
      return {
        valid: false,
        message: `Missing captain assignment for pick id: ${pickId}`,
      };
    }
    if (!captainIdSet.has(captainId)) {
      return {
        valid: false,
        message: `Unknown captain id for ${pickId}: ${captainId}`,
      };
    }
  }
  for (const pickId of Object.keys(typedAssignments)) {
    if (!pickIdSet.has(pickId)) {
      return { valid: false, message: `Unknown pick id in assignments: ${pickId}` };
    }
  }
  const normalized: CaptainAssignments = {};
  for (const pickId of order) {
    normalized[pickId] = typedAssignments[pickId] as string;
  }
  return { valid: true, assignments: normalized };
};

export const authorizeDraftAccess = (params: {
  draft: DraftRecord;
  userId: number;
  editKey: string;
}): boolean => {
  if (params.draft.ownerUserId !== params.userId) {
    return false;
  }
  const expectedHash = hashEditKey(params.editKey);
  return safeEqual(expectedHash, params.draft.editKeyHash);
};
