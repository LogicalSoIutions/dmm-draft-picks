import { describe, expect, it } from "vitest";

import { createDefaultCaptainAssignments, defaultPickOrder } from "@/data/participants";
import { authorizeDraftAccess, hashEditKey, validatePickOrder } from "@/lib/draft";

describe("validatePickOrder", () => {
  it("accepts the seeded default pick order", () => {
    const result = validatePickOrder(defaultPickOrder);
    expect(result.valid).toBe(true);
  });

  it("rejects duplicate picks", () => {
    const invalid = [...defaultPickOrder];
    invalid[1] = invalid[0];
    const result = validatePickOrder(invalid);
    expect(result.valid).toBe(false);
  });
});

describe("authorizeDraftAccess", () => {
  it("allows owner with matching edit key", () => {
    const draft = {
      publicId: "public",
      ownerUserId: 4,
      editKeyHash: hashEditKey("secret-key"),
      picksOrder: defaultPickOrder,
      captainAssignments: createDefaultCaptainAssignments(defaultPickOrder),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = authorizeDraftAccess({
      draft,
      userId: 4,
      editKey: "secret-key",
    });
    expect(result).toBe(true);
  });

  it("rejects non-owner or wrong key", () => {
    const draft = {
      publicId: "public",
      ownerUserId: 4,
      editKeyHash: hashEditKey("secret-key"),
      picksOrder: defaultPickOrder,
      captainAssignments: createDefaultCaptainAssignments(defaultPickOrder),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const wrongOwner = authorizeDraftAccess({
      draft,
      userId: 5,
      editKey: "secret-key",
    });
    const wrongKey = authorizeDraftAccess({
      draft,
      userId: 4,
      editKey: "different-key",
    });
    expect(wrongOwner).toBe(false);
    expect(wrongKey).toBe(false);
  });
});
