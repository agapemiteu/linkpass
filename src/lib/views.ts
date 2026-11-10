import "server-only";
import { getDb } from "@/lib/db";
import { balances } from "@/lib/finance/ledger";
import { activePolicy, type PurchaseStatus } from "@/lib/purchases";

export const ngn = (kobo: number) =>
  "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0, maximumFractionDigits: 2 });

export type PurchaseCard = {
  id: string; status: PurchaseStatus; price_kobo: number; title: string; image_url: string; category: string;
  merchant: string; merchant_verified: number; resolved_account_name: string; bank_account_number: string;
  reason_codes: string; created_at: string; updated_at: string; bank_reference: string | null; mode: string | null;
  bank_status: string | null; last_error: string | null; approval_method: string | null; child_name: string; payment_url: string | null;
};

const PURCHASE_SQL = `SELECT p.id, p.status, p.price_kobo, p.reason_codes, p.created_at, p.updated_at, o.title, o.image_url, o.category,
  m.display_name AS merchant, (m.identity_verification_status = 'VERIFIED') AS merchant_verified, m.resolved_account_name, m.bank_account_number,
  a.bank_reference, a.mode, a.bank_status, a.last_error, a.payment_url, ap.method AS approval_method, u.display_name AS child_name
  FROM purchase_requests p JOIN offers o ON o.id = p.offer_id JOIN merchants m ON m.id = p.merchant_id JOIN users u ON u.id = p.child_id
  LEFT JOIN payment_attempts a ON a.purchase_request_id = p.id LEFT JOIN approvals ap ON ap.purchase_request_id = p.id`;

export function purchasesFor(childId: string, limit = 20) {
  return getDb().prepare(`${PURCHASE_SQL} WHERE p.child_id = ? ORDER BY p.created_at DESC LIMIT ?`).all(childId, limit) as PurchaseCard[];
}

export function purchaseFor(id: string, familyId: string) {
  return getDb().prepare(`${PURCHASE_SQL} WHERE p.id = ? AND u.family_id = ?`).get(id, familyId) as PurchaseCard | undefined;
}

export function familySummary(childId: string) {
  const db = getDb();
  const policy = activePolicy(db, childId);
  const merchantNames = policy
    ? (db.prepare(`SELECT id, display_name FROM merchants WHERE id IN (${policy.merchants.map(() => "?").join(",") || "''"})`).all(...policy.merchants.map((m) => m.merchantId)) as { id: string; display_name: string }[])
    : [];
  return { balances: balances(db, childId), policy, merchantNames };
}

export function verifiedMerchants() {
  return getDb().prepare("SELECT id, display_name, category FROM merchants WHERE identity_verification_status = 'VERIFIED' AND active = 1 ORDER BY display_name").all() as { id: string; display_name: string; category: string }[];
}

export function activity(childId: string, limit = 30) {
  return getDb().prepare("SELECT * FROM audit_events WHERE child_id = ? ORDER BY id DESC LIMIT ?").all(childId, limit) as {
    id: number; purchase_request_id: string | null; actor: string; event: string; detail: string | null; created_at: string;
  }[];
}

export const STATUS_LABEL: Record<PurchaseStatus, string> = {
  AUTO_APPROVED: "Ready to buy",
  NEEDS_PARENT_APPROVAL: "Ask parent",
  BLOCKED: "Blocked",
  APPROVAL_REQUIRED: "Waiting for parent",
  DECLINED: "Declined",
  APPROVED: "Approved",
  PAYMENT_READY: "Awaiting checkout",
  RESERVED: "Funds reserved",
  PAYMENT_PENDING: "Payment processing",
  PAID: "Payment confirmed",
  FAILED: "Payment failed",
  REVERSED: "Reversed",
};

export const TONE: Record<PurchaseStatus, "go" | "ask" | "stop" | "neutral"> = {
  AUTO_APPROVED: "go", PAID: "go", APPROVED: "go",
  NEEDS_PARENT_APPROVAL: "ask", APPROVAL_REQUIRED: "ask", PAYMENT_READY: "ask", RESERVED: "ask", PAYMENT_PENDING: "ask",
  BLOCKED: "stop", DECLINED: "stop", FAILED: "stop", REVERSED: "stop",
};
