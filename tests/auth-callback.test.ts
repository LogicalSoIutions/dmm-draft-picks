import { describe, expect, it } from "vitest";

import { validateKickCallbackInput } from "@/lib/auth-callback";

describe("validateKickCallbackInput", () => {
  it("accepts a valid callback payload", () => {
    const now = Date.now();
    const result = validateKickCallbackInput({
      code: "abc",
      state: "state-1",
      expectedState: "state-1",
      cookieCreatedAt: now - 1_000,
      maxAgeMs: 10_000,
      nowMs: now,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects state mismatch", () => {
    const now = Date.now();
    const result = validateKickCallbackInput({
      code: "abc",
      state: "state-1",
      expectedState: "state-2",
      cookieCreatedAt: now - 1_000,
      maxAgeMs: 10_000,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("mismatch");
    }
  });

  it("rejects expired callback cookie", () => {
    const now = Date.now();
    const result = validateKickCallbackInput({
      code: "abc",
      state: "state-1",
      expectedState: "state-1",
      cookieCreatedAt: now - 20_000,
      maxAgeMs: 10_000,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("expired");
    }
  });
});
