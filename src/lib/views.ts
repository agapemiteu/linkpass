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

export async function purchasesFor(childId: string, limit = 20) {
  const rows = await (await getDb()).all<PurchaseCard>(`${PURCHASE_SQL} WHERE p.child_id = ? ORDER BY p.created_at DESC LIMIT ?`, childId, limit);
  return rows.map(num);
}

export async function purchaseFor(id: string, familyId: string) {
  const row = await (await getDb()).get<PurchaseCard>(`${PURCHASE_SQL} WHERE p.id = ? AND u.family_id = ?`, id, familyId);
  return row && num(row);
}

// libSQL can return numeric columns as strings or bigints; normalise the ones the UI does maths on.
const num = (p: PurchaseCard): PurchaseCard => ({ ...p, price_kobo: Number(p.price_kobo), merchant_verified: Number(p.merchant_verified) });

export async function familySummary(childId: string) {
  const db = await getDb();
  const policy = await activePolicy(db, childId);
  const ids = policy?.merchants.map((m) => m.merchantId) ?? [];
  const merchantNames = ids.length
    ? await db.all<{ id: string; display_name: string }>(`SELECT id, display_name FROM merchants WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids)
    : [];
  return { balances: await balances(db, childId), policy, merchantNames };
}

export async function verifiedMerchants() {
  return (await getDb()).all<{ id: string; display_name: string; category: string }>(
    "SELECT id, display_name, category FROM merchants WHERE identity_verification_status = 'VERIFIED' AND active = 1 ORDER BY display_name",
  );
}

export async function activity(childId: string, limit = 30) {
  return (await getDb()).all<{ id: number; purchase_request_id: string | null; actor: string; event: string; detail: string | null; created_at: string }>(
    "SELECT * FROM audit_events WHERE child_id = ? ORDER BY id DESC LIMIT ?", childId, limit,
  );
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
