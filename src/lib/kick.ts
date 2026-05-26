import { z } from "zod";

import { getKickConfig } from "@/lib/env";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  scope: z.string().min(1),
});

export type KickTokenBundle = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
};

export type KickIdentity = {
  kickUserId: string | null;
  kickUsername: string;
};

const buildTokenRequestBody = (input: Record<string, string>): string => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    body.set(key, value);
  }
  return body.toString();
};

const parseTokenResponse = (payload: unknown): KickTokenBundle => {
  const parsed = tokenSchema.parse(payload);
  const expiresIn =
    typeof parsed.expires_in === "number"
      ? parsed.expires_in
      : Number.parseInt(parsed.expires_in, 10);
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    tokenType: parsed.token_type,
    expiresIn,
    scope: parsed.scope,
  };
};

const parseIdentity = (payload: unknown): KickIdentity | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const candidates: Array<Record<string, unknown>> = [];
  candidates.push(root);
  if (typeof root.data === "object" && root.data !== null) {
    if (Array.isArray(root.data)) {
      for (const item of root.data) {
        if (typeof item === "object" && item !== null) {
          candidates.push(item as Record<string, unknown>);
        }
      }
    } else {
      candidates.push(root.data as Record<string, unknown>);
    }
  }
  if (typeof root.user === "object" && root.user !== null) {
    candidates.push(root.user as Record<string, unknown>);
  }
  for (const candidate of candidates) {
    const usernameRaw = candidate.username ?? candidate.name ?? candidate.login;
    if (typeof usernameRaw !== "string" || usernameRaw.length === 0) {
      continue;
    }
    const idRaw = candidate.id ?? candidate.user_id ?? candidate.userId;
    const kickUserId =
      typeof idRaw === "string" || typeof idRaw === "number"
        ? String(idRaw)
        : null;
    return {
      kickUsername: usernameRaw,
      kickUserId,
    };
  }
  return null;
};

const tokenEndpoint = "https://id.kick.com/oauth/token";

export const getKickAuthorizeUrl = (params: {
  state: string;
  codeChallenge: string;
}): string => {
  const config = getKickConfig();
  const url = new URL("https://id.kick.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  return url.toString();
};

export const exchangeCodeForTokens = async (
  code: string,
  codeVerifier: string,
): Promise<KickTokenBundle> => {
  const config = getKickConfig();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: buildTokenRequestBody({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
      code,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Kick token exchange failed with status ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return parseTokenResponse(payload);
};

export const refreshTokens = async (
  refreshToken: string,
): Promise<KickTokenBundle> => {
  const config = getKickConfig();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: buildTokenRequestBody({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Kick token refresh failed with status ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return parseTokenResponse(payload);
};

export const fetchKickIdentity = async (
  accessToken: string,
): Promise<KickIdentity> => {
  const config = getKickConfig();
  const getEndpoints = [`${config.apiBaseUrl}/users`, `${config.apiBaseUrl}/user`];
  for (const endpoint of getEndpoints) {
    const response = await fetch(endpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      continue;
    }
    const payload = (await response.json()) as unknown;
    const identity = parseIdentity(payload);
    if (identity) {
      return identity;
    }
  }
  const introspectResponse = await fetch(
    `${config.apiBaseUrl}/token/introspect`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Bearer ${accessToken}`,
      },
      body: buildTokenRequestBody({ token: accessToken }),
      cache: "no-store",
    },
  );
  if (introspectResponse.ok) {
    const payload = (await introspectResponse.json()) as unknown;
    const identity = parseIdentity(payload);
    if (identity) {
      return identity;
    }
  }
  throw new Error("Unable to resolve Kick username from user:read token");
};
