import { NextRequest, NextResponse } from "next/server";

import { validateKickCallbackInput } from "@/lib/auth-callback";
import { sha256Hex } from "@/lib/crypto";
import { getKickConfig } from "@/lib/env";
import { exchangeCodeForTokens, fetchKickIdentity } from "@/lib/kick";
import {
  SESSION_MAX_AGE_SECONDS,
  clearOAuthCookie,
  createSessionToken,
  setSessionCookie,
  readOAuthCookie,
} from "@/lib/session";
import { createSession, upsertKickUser } from "@/server/db/queries";

const readForwardedOrigin = (request: NextRequest): string | null => {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  if (!forwardedHost || !forwardedProto) {
    return null;
  }
  return `${forwardedProto}://${forwardedHost}`;
};

const resolvePublicOrigin = (request: NextRequest): string => {
  const forwardedOrigin = readForwardedOrigin(request);
  if (forwardedOrigin) {
    return forwardedOrigin;
  }
  try {
    return new URL(getKickConfig().redirectUri).origin;
  } catch {
    return request.nextUrl.origin;
  }
};

const classifyCallbackFailure = (reason: string): string => {
  if (reason.includes("Token encryption key")) {
    return "server_config_invalid_token_key";
  }
  if (reason.includes("Missing token encryption key")) {
    return "server_config_missing_token_key";
  }
  if (reason.includes("Kick token exchange failed")) {
    return "kick_token_exchange_failed";
  }
  if (reason.includes("Unable to resolve Kick username")) {
    return "kick_user_lookup_failed";
  }
  return "kick_callback_failed";
};

const redirectWithError = (
  request: NextRequest,
  error: string,
  status = 302,
): NextResponse => {
  const url = new URL("/", resolvePublicOrigin(request));
  url.searchParams.set("authError", error);
  const response = NextResponse.redirect(url, status);
  clearOAuthCookie(response);
  return response;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const callbackError = request.nextUrl.searchParams.get("error");
  if (callbackError) {
    return redirectWithError(request, "kick_authorization_rejected");
  }
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthCookie = readOAuthCookie(request.cookies);
  const validation = validateKickCallbackInput({
    code,
    state,
    expectedState: oauthCookie?.state ?? null,
    cookieCreatedAt: oauthCookie?.createdAt ?? null,
    maxAgeMs: 10 * 60 * 1000,
    nowMs: Date.now(),
  });
  if (!validation.ok || !oauthCookie) {
    return redirectWithError(request, "invalid_oauth_callback");
  }
  if (!code) {
    return redirectWithError(request, "invalid_oauth_callback");
  }
  try {
    const tokenBundle = await exchangeCodeForTokens(code, oauthCookie.codeVerifier);
    const identity = await fetchKickIdentity(tokenBundle.accessToken);
    const user = upsertKickUser({
      kickUserId: identity.kickUserId,
      kickUsername: identity.kickUsername,
      tokens: {
        accessToken: tokenBundle.accessToken,
        refreshToken: tokenBundle.refreshToken,
        tokenType: tokenBundle.tokenType,
        expiresIn: tokenBundle.expiresIn,
        scope: tokenBundle.scope,
      },
    });
    const sessionId = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const userAgentHash = sha256Hex(userAgent);
    createSession({
      sessionId,
      userId: user.id,
      expiresAt,
      userAgentHash,
    });
    const destination = oauthCookie.returnTo ?? "/draft/new";
    const response = NextResponse.redirect(
      new URL(destination, resolvePublicOrigin(request)),
    );
    setSessionCookie(response, sessionId);
    clearOAuthCookie(response);
    console.info("Kick login success", {
      kickUsername: user.kickUsername,
      sessionCreated: true,
    });
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    const code = classifyCallbackFailure(reason);
    console.error("Kick callback failed", { code, reason });
    return redirectWithError(request, code);
  }
}
