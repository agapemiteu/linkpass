import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

let db: Database.Database | null = null;

function dbPath() {
  const url = process.env.DATABASE_URL ?? "file:./data/linkpass.db";
  return url.replace(/^file:/, "");
}

export function openDb(file = dbPath()) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  conn.exec(SCHEMA);
  const seeded = conn.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (seeded.n === 0) seed(conn);
  return conn;
}

export function getDb() {
  if (!db) db = openDb();
  return db;
}

// Test hook: swap in an isolated database.
export function setDb(conn: Database.Database) {
  db = conn;
}

export function resetDb() {
  const conn = getDb();
  const tables = conn
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  conn.pragma("foreign_keys = OFF");
  conn.transaction(() => {
    for (const t of tables) conn.exec(`DELETE FROM ${t.name}`);
    seed(conn);
  })();
  conn.pragma("foreign_keys = ON");
}

export const now = () => new Date().toISOString();
