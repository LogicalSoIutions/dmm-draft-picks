import { getEnv } from "@/lib/env";
import { formatEasternDateTimeFromDate } from "@/lib/format-date";

export const getNewDraftSubmissionDeadline = (): Date => {
  const raw = getEnv().DRAFT_NEW_SUBMISSION_DEADLINE;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid DRAFT_NEW_SUBMISSION_DEADLINE: ${raw}`);
  }
  return parsed;
};

export const isNewDraftSubmissionOpen = (at: Date = new Date()): boolean =>
  at.getTime() < getNewDraftSubmissionDeadline().getTime();

export const formatNewDraftSubmissionDeadline = (): string =>
  formatEasternDateTimeFromDate(getNewDraftSubmissionDeadline(), { long: true });
