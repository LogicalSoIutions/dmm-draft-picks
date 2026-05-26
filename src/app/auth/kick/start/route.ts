import { NextRequest, NextResponse } from "next/server";

import { randomId, sha256Base64Url } from "@/lib/crypto";
import { getKickAuthorizeUrl } from "@/lib/kick";
import { setOAuthCookie } from "@/lib/session";

const normalizeReturnTo = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = normalizeReturnTo(request.nextUrl.searchParams.get("next"));
  const state = randomId(18);
  const codeVerifier = randomId(48);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const redirectTo = getKickAuthorizeUrl({ state, codeChallenge });
  const response = NextResponse.redirect(redirectTo);
  setOAuthCookie(response, {
    state,
    codeVerifier,
    returnTo,
    createdAt: Date.now(),
  });
  return response;
}
