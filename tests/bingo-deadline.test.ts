import { afterEach, describe, expect, it } from "vitest";

import {
  formatBingoSubmissionDeadline,
  getBingoSubmissionDeadline,
  isBingoSubmissionOpen,
} from "@/lib/bingo-deadline";

const originalDeadline = process.env.BINGO_SUBMISSION_DEADLINE;

afterEach(() => {
  if (originalDeadline === undefined) {
    delete process.env.BINGO_SUBMISSION_DEADLINE;
  } else {
    process.env.BINGO_SUBMISSION_DEADLINE = originalDeadline;
  }
});

describe("bingo submission deadline", () => {
  it("defaults to 2:00 PM EDT on 31 May 2026", () => {
    delete process.env.BINGO_SUBMISSION_DEADLINE;
    const deadline = getBingoSubmissionDeadline();
    expect(deadline.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  it("accepts cards before the deadline", () => {
    delete process.env.BINGO_SUBMISSION_DEADLINE;
    expect(isBingoSubmissionOpen(new Date("2026-05-31T17:59:59.999Z"))).toBe(
      true,
    );
  });

  it("locks cards at or after the deadline", () => {
    delete process.env.BINGO_SUBMISSION_DEADLINE;
    expect(isBingoSubmissionOpen(new Date("2026-05-31T18:00:00.000Z"))).toBe(
      false,
    );
    expect(isBingoSubmissionOpen(new Date("2026-06-01T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("formats the deadline in Eastern Time", () => {
    delete process.env.BINGO_SUBMISSION_DEADLINE;
    const formatted = formatBingoSubmissionDeadline();
    expect(formatted).toContain("May 31, 2026");
    expect(formatted).toContain("2:00 PM");
    expect(formatted).toContain("EDT");
  });
});
