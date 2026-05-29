import { getEnv } from "@/lib/env";
import { formatEasternDateTimeFromDate } from "@/lib/format-date";

export const getBingoSubmissionDeadline = (): Date => {
  const raw = getEnv().BINGO_SUBMISSION_DEADLINE;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid BINGO_SUBMISSION_DEADLINE: ${raw}`);
  }
  return parsed;
};

export const isBingoSubmissionOpen = (at: Date = new Date()): boolean =>
  at.getTime() < getBingoSubmissionDeadline().getTime();

export const formatBingoSubmissionDeadline = (): string =>
  formatEasternDateTimeFromDate(getBingoSubmissionDeadline(), { long: true });
