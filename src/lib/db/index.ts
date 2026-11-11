import Database from "better-sqlite3";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

type Arg = string | number | null;

// One async interface over two backends:
// - a local SQLite file (cluster; streamed to R2 by Litestream)
// - Turso / libSQL over the network (Vercel, where each function has its own disk)
export interface Db {
  all<T>(sql: string, ...args: Arg[]): Promise<T[]>;
  get<T>(sql: string, ...args: Arg[]): Promise<T | undefined>;
  run(sql: string, ...args: Arg[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  // Runs fn as one write transaction; nothing else writes in between.
  tx<T>(fn: (t: Db) => Promise<T>): Promise<T>;
}

// ---- Local SQLite. A process-wide lock serialises every statement and transaction,
// so an async transaction can never interleave with another request's writes.
function sqliteDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  let queue: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };
  const direct: Db = {
    all: async <T>(sql: string, ...a: Arg[]) => conn.prepare(sql).all(...a) as T[],
    get: async <T>(sql: string, ...a: Arg[]) => conn.prepare(sql).get(...a) as T | undefined,
    run: async (sql, ...a) => ({ changes: conn.prepare(sql).run(...a).changes }),
    exec: async (sql) => void conn.exec(sql),
    tx: (fn) => fn(direct),
  };
  return {
    all: (sql, ...a) => locked(() => direct.all(sql, ...a)),
    get: (sql, ...a) => locked(() => direct.get(sql, ...a)),
    run: (sql, ...a) => locked(() => direct.run(sql, ...a)),
    exec: (sql) => locked(() => direct.exec(sql)),
    tx: (fn) =>
      locked(async () => {
        conn.exec("BEGIN IMMEDIATE");
        try {
          const out = await fn(direct);
          conn.exec("COMMIT");
          return out;
        } catch (e) {
          conn.exec("ROLLBACK");
          throw e;
        }
      }),
  };
}

// ---- Turso / libSQL.
function libsqlDb(client: Client): Db {
  const wrap = (x: Client | Transaction): Db => {
    const exec = async (sql: string, args: Arg[]) => {
      const rs = await x.execute({ sql, args: args as InValue[] });
      return { rows: rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]]))), changes: rs.rowsAffected };
    };
    return {
      all: async <T>(sql: string, ...a: Arg[]) => (await exec(sql, a)).rows as T[],
      get: async <T>(sql: string, ...a: Arg[]) => (await exec(sql, a)).rows[0] as T | undefined,
      run: async (sql, ...a) => ({ changes: (await exec(sql, a)).changes }),
      exec: async (sql) => void (await x.executeMultiple(sql)),
      tx: async (fn) => {
        if (x !== client) return fn(wrap(x));
        const t = await client.transaction("write");
        try {
          const out = await fn(wrap(t));
          await t.commit();
          return out;
        } catch (e) {
          await t.rollback();
          throw e;
        } finally {
          t.close();
        }
      },
    };
  };
  return wrap(client);
}

async function init(db: Db) {
  await db.exec(SCHEMA);
  const seeded = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if (!seeded || Number(seeded.n) === 0) await db.tx((t) => seed(t));
  return db;
}

// Turso (set by the Vercel Marketplace integration) wins; otherwise a local file.
export function openDb(url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./data/linkpass.db"): Promise<Db> {
  if (url.startsWith("libsql:") || url.startsWith("https:")) {
    return init(libsqlDb(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN })));
  }
  return init(sqliteDb(url.replace(/^file:/, "")));
}

let db: Promise<Db> | null = null;

export function getDb() {
  db ??= openDb();
  return db;
}

export async function resetDb() {
  const d = await getDb();
  const tables = await d.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  await d.exec("PRAGMA foreign_keys = OFF");
  await d.tx(async (t) => {
    // Children before parents so foreign keys hold even where the pragma is ignored.
    const order = ["ledger_entries", "ledger_transactions", "payment_attempts", "approvals", "purchase_requests", "funding_events", "policy_categories", "policy_merchants", "policies", "offers", "merchant_social_profiles", "merchants", "users"];
    for (const name of [...order, ...tables.map((x) => x.name).filter((n) => !order.includes(n))]) {
      if (tables.some((x) => x.name === name)) await t.run(`DELETE FROM ${name}`);
    }
    await seed(t);
  });
  await d.exec("PRAGMA foreign_keys = ON");
}

export const now = () => new Date().toISOString();
