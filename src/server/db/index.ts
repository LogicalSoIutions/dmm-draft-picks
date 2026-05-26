import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getEnv } from "@/lib/env";

let dbInstance: Database.Database | null = null;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const resolveDbPath = (): string => {
  const configured = getEnv().SQLITE_PATH;
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(projectRoot, configured);
};

const ensureDbDirectory = (dbPath: string): void => {
  const dir = path.dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const runSchemaMigrations = (db: Database.Database): void => {
  const schemaPath = path.join(projectRoot, "src/server/db/schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
};

export const getDb = (): Database.Database => {
  if (dbInstance) {
    return dbInstance;
  }
  const dbPath = resolveDbPath();
  ensureDbDirectory(dbPath);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  runSchemaMigrations(db);
  dbInstance = db;
  return db;
};
