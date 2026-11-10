import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type LedgerAccount = "FUNDING" | "AVAILABLE" | "RESERVED" | "SPENT";

// Each event moves money between two of the child's ledger accounts.
const MOVES = {
  FUND: ["FUNDING", "AVAILABLE"],
  RESERVE: ["AVAILABLE", "RESERVED"],
  SETTLE: ["RESERVED", "SPENT"],
  RELEASE: ["RESERVED", "AVAILABLE"],
  REVERSE: ["SPENT", "AVAILABLE"],
} as const satisfies Record<string, [LedgerAccount, LedgerAccount]>;

export type LedgerEvent = keyof typeof MOVES;

export function post(db: Database.Database, childId: string, event: LedgerEvent, businessRef: string, amountKobo: number) {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new Error("amount must be positive integer kobo");
  const [from, to] = MOVES[event];
  const txId = randomUUID();
  // business_reference is UNIQUE, so the same event can never be booked twice.
  db.prepare("INSERT INTO ledger_transactions VALUES (?,?,?,?,?)").run(
    txId, `${event}:${businessRef}`, event, childId, new Date().toISOString(),
  );
  const entry = db.prepare("INSERT INTO ledger_entries (transaction_id, account, child_id, amount_kobo) VALUES (?,?,?,?)");
  entry.run(txId, from, childId, -amountKobo);
  entry.run(txId, to, childId, amountKobo);
}

export function hasPosted(db: Database.Database, event: LedgerEvent, businessRef: string) {
  return !!db.prepare("SELECT 1 FROM ledger_transactions WHERE business_reference = ?").get(`${event}:${businessRef}`);
}

export type Balances = { fundedKobo: number; availableKobo: number; reservedKobo: number; spentKobo: number };

export function balances(db: Database.Database, childId: string): Balances {
  const rows = db
    .prepare("SELECT account, COALESCE(SUM(amount_kobo),0) AS total FROM ledger_entries WHERE child_id = ? GROUP BY account")
    .all(childId) as { account: LedgerAccount; total: number }[];
  const get = (a: LedgerAccount) => rows.find((r) => r.account === a)?.total ?? 0;
  return { fundedKobo: -get("FUNDING"), availableKobo: get("AVAILABLE"), reservedKobo: get("RESERVED"), spentKobo: get("SPENT") };
}

// Sum of everything families can still spend; must never exceed verified bank funds.
export function outstandingEntitlementsKobo(db: Database.Database) {
  const r = db
    .prepare("SELECT COALESCE(SUM(amount_kobo),0) AS t FROM ledger_entries WHERE account IN ('AVAILABLE','RESERVED')")
    .get() as { t: number };
  return r.t;
}
