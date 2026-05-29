import { isAdminUsername } from "@/lib/admin";
import { getEnv } from "@/lib/env";

export const isTestingWinnerMode = (): boolean => {
  const raw = getEnv().TESTING_WINNER.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
};

/** When TESTING_WINNER is on, only admins may see official-draft scoring UI. */
export const canViewOfficialDraftResults = (
  kickUsername: string | null | undefined,
): boolean => {
  if (!isTestingWinnerMode()) {
    return true;
  }
  if (!kickUsername) {
    return false;
  }
  return isAdminUsername(kickUsername);
};
