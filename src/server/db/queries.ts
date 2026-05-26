import { encryptTokenField } from "@/lib/crypto";
import {
  captainIdSet,
  createDefaultCaptainAssignments,
  pickIdSet,
  type CaptainAssignments,
} from "@/data/participants";
import { getDb } from "@/server/db/index";

export type OAuthTokenBundle = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
};

export type UserRecord = {
  id: number;
  kickUserId: string | null;
  kickUsername: string;
  tokenUpdatedAt: string;
  createdAt: string;
};

export type UserTokenRecord = {
  userId: number;
  kickUsername: string;
  kickUserId: string | null;
  tokenUpdatedAt: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenTypeEncrypted: string;
  expiresInEncrypted: string;
  scopeEncrypted: string;
};

export type SessionWithUser = {
  id: string;
  userId: number;
  expiresAt: string;
  userAgentHash: string | null;
  kickUsername: string;
  kickUserId: string | null;
};

export type DraftRecord = {
  publicId: string;
  ownerUserId: number;
  editKeyHash: string;
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
  createdAt: string;
  updatedAt: string;
};

export type OfficialDraftRecord = {
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
  setByUserId: number;
  updatedAt: string;
};

export type OfficialDraftMatch = {
  publicId: string;
  ownerUserId: number;
  kickUsername: string;
  updatedAt: string;
};

export type DraftWithOwner = {
  publicId: string;
  ownerUserId: number;
  ownerKickUsername: string;
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
  createdAt: string;
  updatedAt: string;
};

type UserRow = {
  id: number;
  kick_user_id: string | null;
  kick_username: string;
  token_updated_at: string;
  created_at: string;
};

type SessionWithUserRow = {
  id: string;
  user_id: number;
  expires_at: string;
  user_agent_hash: string | null;
  kick_username: string;
  kick_user_id: string | null;
};

type UserTokenRow = {
  user_id: number;
  kick_username: string;
  kick_user_id: string | null;
  token_updated_at: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_type_encrypted: string;
  expires_in_encrypted: string;
  scope_encrypted: string;
};

type DraftRow = {
  public_id: string;
  owner_user_id: number;
  edit_key_hash: string;
  picks_order_json: string;
  captain_assignments_json: string | null;
  created_at: string;
  updated_at: string;
};

type OfficialDraftRow = {
  picks_order_json: string;
  captain_assignments_json: string;
  set_by_user_id: number;
  updated_at: string;
};

type OfficialMatchRow = {
  public_id: string;
  owner_user_id: number;
  kick_username: string;
  updated_at: string;
};

type DraftWithOwnerRow = {
  public_id: string;
  owner_user_id: number;
  owner_kick_username: string;
  picks_order_json: string;
  captain_assignments_json: string | null;
  created_at: string;
  updated_at: string;
};

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  kickUserId: row.kick_user_id,
  kickUsername: row.kick_username,
  tokenUpdatedAt: row.token_updated_at,
  createdAt: row.created_at,
});

const mapSession = (row: SessionWithUserRow): SessionWithUser => ({
  id: row.id,
  userId: row.user_id,
  expiresAt: row.expires_at,
  userAgentHash: row.user_agent_hash,
  kickUsername: row.kick_username,
  kickUserId: row.kick_user_id,
});

const parseDraftPayload = (
  picksOrderJson: string,
  captainAssignmentsJson: string | null,
): { order: string[]; captainAssignments: CaptainAssignments } => {
  const parsed = JSON.parse(picksOrderJson);
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("Invalid picks order payload in database");
  }
  const order = parsed as string[];
  const rawAssignments = captainAssignmentsJson
    ? JSON.parse(captainAssignmentsJson)
    : createDefaultCaptainAssignments(order);
  if (
    typeof rawAssignments !== "object" ||
    rawAssignments === null ||
    Array.isArray(rawAssignments)
  ) {
    throw new Error("Invalid captain assignments payload in database");
  }
  const typedAssignments = rawAssignments as Record<string, unknown>;
  for (const pickId of order) {
    const captainId = typedAssignments[pickId];
    if (typeof captainId !== "string" || !captainIdSet.has(captainId)) {
      throw new Error("Invalid captain assignments payload in database");
    }
  }
  for (const pickId of Object.keys(typedAssignments)) {
    if (!pickIdSet.has(pickId)) {
      throw new Error("Invalid captain assignments payload in database");
    }
  }
  const captainAssignments: CaptainAssignments = {};
  for (const pickId of order) {
    captainAssignments[pickId] = typedAssignments[pickId] as string;
  }
  return { order, captainAssignments };
};

const mapDraft = (row: DraftRow): DraftRecord => {
  const { order, captainAssignments } = parseDraftPayload(
    row.picks_order_json,
    row.captain_assignments_json,
  );
  return {
    publicId: row.public_id,
    ownerUserId: row.owner_user_id,
    editKeyHash: row.edit_key_hash,
    picksOrder: order,
    captainAssignments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapDraftWithOwner = (row: DraftWithOwnerRow): DraftWithOwner => {
  const { order, captainAssignments } = parseDraftPayload(
    row.picks_order_json,
    row.captain_assignments_json,
  );
  return {
    publicId: row.public_id,
    ownerUserId: row.owner_user_id,
    ownerKickUsername: row.owner_kick_username,
    picksOrder: order,
    captainAssignments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapUserToken = (row: UserTokenRow): UserTokenRecord => ({
  userId: row.user_id,
  kickUsername: row.kick_username,
  kickUserId: row.kick_user_id,
  tokenUpdatedAt: row.token_updated_at,
  accessTokenEncrypted: row.access_token_encrypted,
  refreshTokenEncrypted: row.refresh_token_encrypted,
  tokenTypeEncrypted: row.token_type_encrypted,
  expiresInEncrypted: row.expires_in_encrypted,
  scopeEncrypted: row.scope_encrypted,
});

export const upsertKickUser = (params: {
  kickUserId: string | null;
  kickUsername: string;
  tokens: OAuthTokenBundle;
}): UserRecord => {
  const db = getDb();
  const encryptedAccess = encryptTokenField(params.tokens.accessToken);
  const encryptedRefresh = encryptTokenField(params.tokens.refreshToken);
  const encryptedType = encryptTokenField(params.tokens.tokenType);
  const encryptedExpiry = encryptTokenField(String(params.tokens.expiresIn));
  const encryptedScope = encryptTokenField(params.tokens.scope);
  db.prepare(
    `
      INSERT INTO users (
        kick_user_id,
        kick_username,
        token_key_version,
        access_token_encrypted,
        refresh_token_encrypted,
        token_type_encrypted,
        expires_in_encrypted,
        scope_encrypted
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kick_username)
      DO UPDATE SET
        kick_user_id = excluded.kick_user_id,
        token_key_version = excluded.token_key_version,
        access_token_encrypted = excluded.access_token_encrypted,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        token_type_encrypted = excluded.token_type_encrypted,
        expires_in_encrypted = excluded.expires_in_encrypted,
        scope_encrypted = excluded.scope_encrypted,
        token_updated_at = CURRENT_TIMESTAMP
    `,
  ).run(
    params.kickUserId,
    params.kickUsername,
    encryptedAccess.keyVersion,
    encryptedAccess.encrypted,
    encryptedRefresh.encrypted,
    encryptedType.encrypted,
    encryptedExpiry.encrypted,
    encryptedScope.encrypted,
  );
  const row = db
    .prepare(
      "SELECT id, kick_user_id, kick_username, token_updated_at, created_at FROM users WHERE kick_username = ?",
    )
    .get(params.kickUsername) as UserRow | undefined;
  if (!row) {
    throw new Error("Failed to load user after upsert");
  }
  return mapUser(row);
};

export const updateKickUserTokens = (params: {
  userId: number;
  tokens: OAuthTokenBundle;
  kickUserId: string | null;
  kickUsername: string;
}): void => {
  const db = getDb();
  const encryptedAccess = encryptTokenField(params.tokens.accessToken);
  const encryptedRefresh = encryptTokenField(params.tokens.refreshToken);
  const encryptedType = encryptTokenField(params.tokens.tokenType);
  const encryptedExpiry = encryptTokenField(String(params.tokens.expiresIn));
  const encryptedScope = encryptTokenField(params.tokens.scope);
  db.prepare(
    `
      UPDATE users
      SET
        kick_user_id = ?,
        kick_username = ?,
        token_key_version = ?,
        access_token_encrypted = ?,
        refresh_token_encrypted = ?,
        token_type_encrypted = ?,
        expires_in_encrypted = ?,
        scope_encrypted = ?,
        token_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(
    params.kickUserId,
    params.kickUsername,
    encryptedAccess.keyVersion,
    encryptedAccess.encrypted,
    encryptedRefresh.encrypted,
    encryptedType.encrypted,
    encryptedExpiry.encrypted,
    encryptedScope.encrypted,
    params.userId,
  );
};

export const getUserTokenRecordById = (userId: number): UserTokenRecord | null => {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          id as user_id,
          kick_username,
          kick_user_id,
          token_updated_at,
          access_token_encrypted,
          refresh_token_encrypted,
          token_type_encrypted,
          expires_in_encrypted,
          scope_encrypted
        FROM users
        WHERE id = ?
      `,
    )
    .get(userId) as UserTokenRow | undefined;
  return row ? mapUserToken(row) : null;
};

export const createSession = (params: {
  sessionId: string;
  userId: number;
  expiresAt: string;
  userAgentHash: string | null;
}): void => {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO sessions (id, user_id, expires_at, user_agent_hash)
      VALUES (?, ?, ?, ?)
    `,
  ).run(params.sessionId, params.userId, params.expiresAt, params.userAgentHash);
};

export const deleteSession = (sessionId: string): void => {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
};

export const deleteExpiredSessions = (nowIso: string): void => {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso);
};

export const getActiveSessionWithUser = (
  sessionId: string,
  nowIso: string,
): SessionWithUser | null => {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          s.id,
          s.user_id,
          s.expires_at,
          s.user_agent_hash,
          u.kick_username,
          u.kick_user_id
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?
      `,
    )
    .get(sessionId, nowIso) as SessionWithUserRow | undefined;
  return row ? mapSession(row) : null;
};

export const createDraft = (params: {
  publicId: string;
  ownerUserId: number;
  editKeyHash: string;
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
}): DraftRecord => {
  const db = getDb();
  const orderPayload = JSON.stringify(params.picksOrder);
  const assignmentsPayload = JSON.stringify(params.captainAssignments);
  db.prepare(
    `
      INSERT INTO drafts (
        public_id,
        owner_user_id,
        edit_key_hash,
        picks_order_json,
        captain_assignments_json
      )
      VALUES (?, ?, ?, ?, ?)
    `,
  ).run(
    params.publicId,
    params.ownerUserId,
    params.editKeyHash,
    orderPayload,
    assignmentsPayload,
  );
  const row = db
    .prepare(
      `
        SELECT
          public_id,
          owner_user_id,
          edit_key_hash,
          picks_order_json,
          captain_assignments_json,
          created_at,
          updated_at
        FROM drafts
        WHERE public_id = ?
      `,
    )
    .get(params.publicId) as DraftRow | undefined;
  if (!row) {
    throw new Error("Failed to load draft after insert");
  }
  return mapDraft(row);
};

export const getDraftByPublicId = (publicId: string): DraftRecord | null => {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          public_id,
          owner_user_id,
          edit_key_hash,
          picks_order_json,
          captain_assignments_json,
          created_at,
          updated_at
        FROM drafts
        WHERE public_id = ?
      `,
    )
    .get(publicId) as DraftRow | undefined;
  return row ? mapDraft(row) : null;
};

export const getDraftByOwnerUserId = (ownerUserId: number): DraftRecord | null => {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          public_id,
          owner_user_id,
          edit_key_hash,
          picks_order_json,
          captain_assignments_json,
          created_at,
          updated_at
        FROM drafts
        WHERE owner_user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get(ownerUserId) as DraftRow | undefined;
  return row ? mapDraft(row) : null;
};

export const getDraftWithOwnerByPublicId = (
  publicId: string,
): DraftWithOwner | null => {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          d.public_id,
          d.owner_user_id,
          u.kick_username AS owner_kick_username,
          d.picks_order_json,
          d.captain_assignments_json,
          d.created_at,
          d.updated_at
        FROM drafts d
        INNER JOIN users u ON u.id = d.owner_user_id
        WHERE d.public_id = ?
      `,
    )
    .get(publicId) as DraftWithOwnerRow | undefined;
  return row ? mapDraftWithOwner(row) : null;
};

export const listAllDraftsWithOwner = (): DraftWithOwner[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          d.public_id,
          d.owner_user_id,
          u.kick_username AS owner_kick_username,
          d.picks_order_json,
          d.captain_assignments_json,
          d.created_at,
          d.updated_at
        FROM drafts d
        INNER JOIN users u ON u.id = d.owner_user_id
        ORDER BY d.updated_at DESC
      `,
    )
    .all() as DraftWithOwnerRow[];
  return rows.map(mapDraftWithOwner);
};

export const updateDraftOrder = (params: {
  publicId: string;
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
}): DraftRecord | null => {
  const db = getDb();
  const orderPayload = JSON.stringify(params.picksOrder);
  const assignmentsPayload = JSON.stringify(params.captainAssignments);
  const result = db
    .prepare(
      `
        UPDATE drafts
        SET
          picks_order_json = ?,
          captain_assignments_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE public_id = ?
      `,
    )
    .run(orderPayload, assignmentsPayload, params.publicId);
  if (result.changes === 0) {
    return null;
  }
  return getDraftByPublicId(params.publicId);
};

