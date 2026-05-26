import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getTokenKeyset } from "@/lib/env";

const toBase64Url = (input: Buffer): string =>
  input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (input: string): Buffer => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLen), "base64");
};

export const randomId = (size = 24): string => toBase64Url(randomBytes(size));

export const sha256Base64Url = (value: string): string =>
  toBase64Url(createHash("sha256").update(value).digest());

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const signHmac = (value: string, secret: string): string =>
  toBase64Url(createHmac("sha256", secret).update(value).digest());

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

export const encryptTokenField = (value: string): {
  encrypted: string;
  keyVersion: number;
} => {
  const { currentVersion, keys } = getTokenKeyset();
  const key = keys.get(currentVersion);
  if (!key) {
    throw new Error("Missing encryption key");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion: currentVersion,
    encrypted: `${currentVersion}.${toBase64Url(iv)}.${toBase64Url(
      encrypted,
    )}.${toBase64Url(tag)}`,
  };
};

export const decryptTokenField = (encoded: string): string => {
  const [versionText, ivEncoded, payloadEncoded, tagEncoded] = encoded.split(".");
  if (!versionText || !ivEncoded || !payloadEncoded || !tagEncoded) {
    throw new Error("Invalid encrypted field format");
  }
  const version = Number.parseInt(versionText, 10);
  if (Number.isNaN(version)) {
    throw new Error("Invalid encrypted field version");
  }
  const { keys } = getTokenKeyset();
  const key = keys.get(version);
  if (!key) {
    throw new Error(`No key available for version ${version}`);
  }
  const iv = fromBase64Url(ivEncoded);
  const payload = fromBase64Url(payloadEncoded);
  const tag = fromBase64Url(tagEncoded);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString(
    "utf8",
  );
};
