import { getAdminUsernames } from "@/lib/env";

export const isAdminUsername = (kickUsername: string): boolean =>
  getAdminUsernames().has(kickUsername.trim().toLowerCase());
