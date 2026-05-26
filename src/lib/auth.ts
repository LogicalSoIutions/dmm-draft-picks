import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { decryptTokenField } from "@/lib/crypto";
import { fetchKickIdentity, refreshTokens } from "@/lib/kick";
import { readSessionTokenFromCookieStore } from "@/lib/session";
import {
  deleteExpiredSessions,
  deleteSession,
  getActiveSessionWithUser,
  getUserTokenRecordById,
  updateKickUserTokens,
} from "@/server/db/queries";

export type AuthenticatedUser = {
  sessionId: string;
  userId: number;
  kickUsername: string;
  kickUserId: string | null;
};

const nowIso = (): string => new Date().toISOString();

const shouldRefreshToken = (tokenUpdatedAt: string, expiresInSeconds: number): boolean => {
  const updatedAtMs = Date.parse(tokenUpdatedAt);
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }
  const refreshAt = updatedAtMs + expiresInSeconds * 1000 - 60_000;
  return Date.now() >= refreshAt;
};

const maintainUserToken = async (userId: number): Promise<boolean> => {
  const tokenRow = getUserTokenRecordById(userId);
  if (!tokenRow) {
    return false;
  }
  const expiresIn = Number.parseInt(decryptTokenField(tokenRow.expiresInEncrypted), 10);
  if (Number.isNaN(expiresIn) || expiresIn <= 0) {
    return false;
  }
  if (!shouldRefreshToken(tokenRow.tokenUpdatedAt, expiresIn)) {
    return true;
  }
  const refreshToken = decryptTokenField(tokenRow.refreshTokenEncrypted);
  const refreshed = await refreshTokens(refreshToken);
  const identity = await fetchKickIdentity(refreshed.accessToken);
  updateKickUserTokens({
    userId: tokenRow.userId,
    kickUserId: identity.kickUserId,
    kickUsername: identity.kickUsername,
    tokens: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenType: refreshed.tokenType,
      expiresIn: refreshed.expiresIn,
      scope: refreshed.scope,
    },
  });
  return true;
};

const resolveAuthenticatedUserBySessionId = async (
  sessionId: string,
): Promise<AuthenticatedUser | null> => {
  deleteExpiredSessions(nowIso());
  const session = getActiveSessionWithUser(sessionId, nowIso());
  if (!session) {
    return null;
  }
  try {
    const tokenOk = await maintainUserToken(session.userId);
    if (!tokenOk) {
      deleteSession(session.id);
      return null;
    }
    return {
      sessionId: session.id,
      userId: session.userId,
      kickUsername: session.kickUsername,
      kickUserId: session.kickUserId,
    };
  } catch {
    deleteSession(session.id);
    return null;
  }
};

export const getAuthenticatedUserFromRequest = async (
  request: NextRequest,
): Promise<AuthenticatedUser | null> => {
  const sessionId = readSessionTokenFromCookieStore(request.cookies);
  if (!sessionId) {
    return null;
  }
  return resolveAuthenticatedUserBySessionId(sessionId);
};

export const getAuthenticatedUserFromServer = async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const sessionId = readSessionTokenFromCookieStore(cookieStore);
  if (!sessionId) {
    return null;
  }
  return resolveAuthenticatedUserBySessionId(sessionId);
};
