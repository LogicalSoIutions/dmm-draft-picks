import { z } from "zod";

const commonSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  SQLITE_PATH: z.string().optional().default("./data/app.db"),
  SESSION_SECRET: z.string().optional(),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  KICK_CLIENT_ID: z.string().optional(),
  KICK_CLIENT_SECRET: z.string().optional(),
  KICK_REDIRECT_URI: z.string().optional(),
  KICK_SCOPE: z.string().default("user:read"),
  KICK_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.kick.com/public/v1"),
  TOKEN_ENCRYPTION_KEY_VERSION: z
    .string()
    .regex(/^\d+$/)
    .default("1"),
  DRAFT_RATE_LIMIT_PER_MINUTE_USER: z
    .string()
    .regex(/^\d+$/)
    .default("60"),
  DRAFT_NEW_SUBMISSION_DEADLINE: z
    .string()
    .default("2026-05-31T19:00:00+01:00"),
  ADMIN_KICK_USERNAMES: z.string().optional().default(""),
  TESTING_WINNER: z.string().optional().default("false"),
});

type CommonEnv = z.infer<typeof commonSchema>;

const parseCommonEnv = (): CommonEnv => commonSchema.parse(process.env);

const decodeKeyMaterial = (raw: string): Buffer => {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 32) {
      return base64;
    }
  } catch {
    return Buffer.from(trimmed, "utf8");
  }
  return Buffer.from(trimmed, "utf8");
};

export const getEnv = (): CommonEnv => parseCommonEnv();

export const getSessionSecret = (): string => {
  const env = parseCommonEnv();
  if (env.NODE_ENV === "production" && !env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }
  const fallback =
    env.NODE_ENV === "test"
      ? "test-session-secret-0000000000000000"
      : "dev-session-secret-00000000000000000";
  const secret = env.SESSION_SECRET ?? fallback;
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
};

export const getKickConfig = (): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  apiBaseUrl: string;
} => {
  const env = parseCommonEnv();
  if (!env.KICK_CLIENT_ID) {
    throw new Error("KICK_CLIENT_ID is required");
  }
  if (!env.KICK_CLIENT_SECRET) {
    throw new Error("KICK_CLIENT_SECRET is required");
  }
  if (!env.KICK_REDIRECT_URI) {
    throw new Error("KICK_REDIRECT_URI is required");
  }
  const redirectUri = z.string().url().parse(env.KICK_REDIRECT_URI);
  return {
    clientId: env.KICK_CLIENT_ID,
    clientSecret: env.KICK_CLIENT_SECRET,
    redirectUri,
    scope: env.KICK_SCOPE,
    apiBaseUrl: env.KICK_API_BASE_URL,
  };
};

export const getTokenKeyset = (): {
  currentVersion: number;
  keys: Map<number, Buffer>;
} => {
  const env = parseCommonEnv();
  const keys = new Map<number, Buffer>();
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("TOKEN_ENCRYPTION_KEY_V") || !value) {
      continue;
    }
    const versionText = name.slice("TOKEN_ENCRYPTION_KEY_V".length);
    const version = Number.parseInt(versionText, 10);
    if (Number.isNaN(version)) {
      continue;
    }
    const key = decodeKeyMaterial(value);
    if (key.length === 32) {
      keys.set(version, key);
    }
  }
  if (keys.size === 0) {
    const fallback = process.env.TOKEN_ENCRYPTION_KEY ?? getSessionSecret();
    const decoded = decodeKeyMaterial(fallback);
    if (decoded.length !== 32) {
      throw new Error("Token encryption key must decode to 32 bytes");
    }
    keys.set(Number.parseInt(env.TOKEN_ENCRYPTION_KEY_VERSION, 10), decoded);
  }
  const currentVersion = Number.parseInt(env.TOKEN_ENCRYPTION_KEY_VERSION, 10);
  if (!keys.has(currentVersion)) {
    throw new Error(
      `Missing token encryption key for version ${currentVersion}`,
    );
  }
  return { currentVersion, keys };
};

export const isProduction = (): boolean => getEnv().NODE_ENV === "production";

export const getAdminUsernames = (): ReadonlySet<string> => {
  const raw = parseCommonEnv().ADMIN_KICK_USERNAMES;
  const usernames = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return new Set(usernames);
};
