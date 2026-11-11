import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";

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

export async function post(db: Db, childId: string, event: LedgerEvent, businessRef: string, amountKobo: number) {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new Error("amount must be positive integer kobo");
  const [from, to] = MOVES[event];
  const txId = randomUUID();
  // business_reference is UNIQUE, so the same event can never be booked twice.
  await db.run("INSERT INTO ledger_transactions VALUES (?,?,?,?,?)", txId, `${event}:${businessRef}`, event, childId, new Date().toISOString());
  const entry = "INSERT INTO ledger_entries (transaction_id, account, child_id, amount_kobo) VALUES (?,?,?,?)";
  await db.run(entry, txId, from, childId, -amountKobo);
  await db.run(entry, txId, to, childId, amountKobo);
}

export async function hasPosted(db: Db, event: LedgerEvent, businessRef: string) {
  return !!(await db.get("SELECT 1 FROM ledger_transactions WHERE business_reference = ?", `${event}:${businessRef}`));
}

export type Balances = { fundedKobo: number; availableKobo: number; reservedKobo: number; spentKobo: number };

export async function balances(db: Db, childId: string): Promise<Balances> {
  const rows = await db.all<{ account: LedgerAccount; total: number }>(
    "SELECT account, COALESCE(SUM(amount_kobo),0) AS total FROM ledger_entries WHERE child_id = ? GROUP BY account",
    childId,
  );
  const get = (a: LedgerAccount) => Number(rows.find((r) => r.account === a)?.total ?? 0);
  return { fundedKobo: -get("FUNDING"), availableKobo: get("AVAILABLE"), reservedKobo: get("RESERVED"), spentKobo: get("SPENT") };
}

// Sum of everything families can still spend; must never exceed verified bank funds.
export async function outstandingEntitlementsKobo(db: Db) {
  const r = await db.get<{ t: number }>("SELECT COALESCE(SUM(amount_kobo),0) AS t FROM ledger_entries WHERE account IN ('AVAILABLE','RESERVED')");
  return Number(r?.t ?? 0);
}
