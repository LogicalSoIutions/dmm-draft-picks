import { afterEach, describe, expect, it } from "vitest";

import {
  canViewOfficialDraftResults,
  isTestingWinnerMode,
} from "@/lib/official-draft-visibility";

const originalTestingWinner = process.env.TESTING_WINNER;
const originalAdminUsernames = process.env.ADMIN_KICK_USERNAMES;

afterEach(() => {
  if (originalTestingWinner === undefined) {
    delete process.env.TESTING_WINNER;
  } else {
    process.env.TESTING_WINNER = originalTestingWinner;
  }
  if (originalAdminUsernames === undefined) {
    delete process.env.ADMIN_KICK_USERNAMES;
  } else {
    process.env.ADMIN_KICK_USERNAMES = originalAdminUsernames;
  }
});

describe("isTestingWinnerMode", () => {
  it("is false by default", () => {
    delete process.env.TESTING_WINNER;
    expect(isTestingWinnerMode()).toBe(false);
  });

  it.each(["true", "TRUE", "1", "yes"])("is true when TESTING_WINNER=%s", (value) => {
    process.env.TESTING_WINNER = value;
    expect(isTestingWinnerMode()).toBe(true);
  });
});

describe("canViewOfficialDraftResults", () => {
  it("allows everyone when TESTING_WINNER is off", () => {
    process.env.TESTING_WINNER = "false";
    expect(canViewOfficialDraftResults(null)).toBe(true);
    expect(canViewOfficialDraftResults("random_user")).toBe(true);
  });

  it("blocks non-admins when TESTING_WINNER is on", () => {
    process.env.TESTING_WINNER = "true";
    process.env.ADMIN_KICK_USERNAMES = "admin_user";
    expect(canViewOfficialDraftResults(null)).toBe(false);
    expect(canViewOfficialDraftResults("guest")).toBe(false);
    expect(canViewOfficialDraftResults("admin_user")).toBe(true);
    expect(canViewOfficialDraftResults("Admin_User")).toBe(true);
  });
});
