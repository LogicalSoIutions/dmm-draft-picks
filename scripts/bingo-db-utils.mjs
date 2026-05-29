import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const parseDotEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

export const resolveSqlitePath = () => {
  parseDotEnvFile(path.resolve(process.cwd(), ".env"));
  const configured = process.env.SQLITE_PATH || "./data/app.db";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
};

export const openBingoDb = () => {
  const db = new Database(resolveSqlitePath());
  db.pragma("foreign_keys = ON");
  return db;
};

export const ensureBingoTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bingo_options (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tiles_json TEXT NOT NULL,
      set_by_user_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bingo_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      completed_tile_ids_json TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bingo_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL UNIQUE,
      layout_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
