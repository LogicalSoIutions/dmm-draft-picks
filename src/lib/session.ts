import type { NextResponse } from "next/server";

import { getEnv, getSessionSecret, isProduction } from "@/lib/env";
import { randomId, safeEqual, signHmac } from "@/lib/crypto";
import {
  OAUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-constants";

export {
  OAUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-constants";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type OAuthCookiePayload = {
  state: string;
  codeVerifier: string;
  returnTo: string | null;
  createdAt: number;
};

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLen), "base64").toString("utf8");
};

const signValue = (rawValue: string): string =>
  signHmac(rawValue, getSessionSecret());

const encodeSignedValue = (rawValue: string): string => {
  const signature = signValue(rawValue);
  return `${rawValue}.${signature}`;
};

const decodeSignedValue = (cookieValue: string): string | null => {
  const split = cookieValue.lastIndexOf(".");
  if (split <= 0) {
    return null;
  }
  const raw = cookieValue.slice(0, split);
  const signature = cookieValue.slice(split + 1);
  if (!safeEqual(signValue(raw), signature)) {
    return null;
  }
  return raw;
};

const getCookieOptions = () => {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    domain: env.SESSION_COOKIE_DOMAIN,
  };
};

export const createSessionToken = (): string => randomId(24);

export const encodeSessionCookieValue = (sessionToken: string): string =>
  encodeSignedValue(sessionToken);

export const readSessionTokenFromCookieStore = (
  cookieStore: CookieReader,
): string | null => {
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }
  return decodeSignedValue(value);
};

export const setSessionCookie = (
  response: NextResponse,
  sessionToken: string,
): void => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionCookieValue(sessionToken),
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...getCookieOptions(),
  });
};

export const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...getCookieOptions(),
  });
};

export const setOAuthCookie = (
  response: NextResponse,
  payload: OAuthCookiePayload,
): void => {
  const raw = base64UrlEncode(JSON.stringify(payload));
  response.cookies.set({
    name: OAUTH_COOKIE_NAME,
    value: encodeSignedValue(raw),
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    ...getCookieOptions(),
  });
};

export const readOAuthCookie = (
  cookieStore: CookieReader,
): OAuthCookiePayload | null => {
  const value = cookieStore.get(OAUTH_COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }
  const raw = decodeSignedValue(value);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(raw)) as OAuthCookiePayload;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }
    if (parsed.returnTo !== null && typeof parsed.returnTo !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearOAuthCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: OAUTH_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...getCookieOptions(),
  });
};

