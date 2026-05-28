import { afterEach, describe, expect, it } from "vitest";

import {
  formatNewDraftSubmissionDeadline,
  getNewDraftSubmissionDeadline,
  isNewDraftSubmissionOpen,
} from "@/lib/draft-deadline";

const originalDeadline = process.env.DRAFT_NEW_SUBMISSION_DEADLINE;

afterEach(() => {
  if (originalDeadline === undefined) {
    delete process.env.DRAFT_NEW_SUBMISSION_DEADLINE;
  } else {
    process.env.DRAFT_NEW_SUBMISSION_DEADLINE = originalDeadline;
  }
});

describe("draft submission deadline", () => {
  it("defaults to 19:00 BST on 31 May 2026", () => {
    delete process.env.DRAFT_NEW_SUBMISSION_DEADLINE;
    const deadline = getNewDraftSubmissionDeadline();
    expect(deadline.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  it("accepts submissions before the deadline", () => {
    delete process.env.DRAFT_NEW_SUBMISSION_DEADLINE;
    expect(
      isNewDraftSubmissionOpen(new Date("2026-05-31T17:59:59.999Z")),
    ).toBe(true);
  });

  it("rejects submissions at or after the deadline", () => {
    delete process.env.DRAFT_NEW_SUBMISSION_DEADLINE;
    expect(isNewDraftSubmissionOpen(new Date("2026-05-31T18:00:00.000Z"))).toBe(
      false,
    );
    expect(isNewDraftSubmissionOpen(new Date("2026-06-01T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("formats the deadline in Eastern Time", () => {
    delete process.env.DRAFT_NEW_SUBMISSION_DEADLINE;
    const formatted = formatNewDraftSubmissionDeadline();
    expect(formatted).toContain("May 31, 2026");
    expect(formatted).toContain("2:00 PM");
    expect(formatted).toContain("EDT");
    expect(formatted).not.toContain("EST");
  });
});
