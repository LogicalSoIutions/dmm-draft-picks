PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kick_user_id TEXT,
  kick_username TEXT NOT NULL UNIQUE,
  token_key_version INTEGER NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_type_encrypted TEXT NOT NULL,
  expires_in_encrypted TEXT NOT NULL,
  scope_encrypted TEXT NOT NULL,
  token_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id INTEGER NOT NULL,
  edit_key_hash TEXT NOT NULL,
  picks_order_json TEXT NOT NULL,
  captain_assignments_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drafts_owner_user_id ON drafts (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts (created_at);

CREATE TABLE IF NOT EXISTS official_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  picks_order_json TEXT NOT NULL,
  captain_assignments_json TEXT NOT NULL,
  set_by_user_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (set_by_user_id) REFERENCES users(id)
);
