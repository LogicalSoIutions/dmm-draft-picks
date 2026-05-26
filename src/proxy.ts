import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

const userLimit = Number.parseInt(
  process.env.DRAFT_RATE_LIMIT_PER_MINUTE_USER ?? "60",
  10,
);

const windowMs = 60_000;

export function proxy(request: NextRequest): NextResponse {
  if (!request.nextUrl.pathname.startsWith("/api/drafts")) {
    return NextResponse.next();
  }
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const userAllowed = consumeRateLimit(
    "draft_user",
    sessionCookie,
    userLimit,
    windowMs,
  );
  if (!userAllowed) {
    return NextResponse.json(
      { error: "Too many draft requests from this user session" },
      { status: 429 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/drafts/:path*"],
};
