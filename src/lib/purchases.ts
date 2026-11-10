import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { evaluate, type EvaluationResult, type PolicyFacts } from "./policies/evaluator";
import { balances, hasPosted, outstandingEntitlementsKobo, post } from "./finance/ledger";
import { BankError, type BankClient, type TestOutcome, type TransferStatus } from "./bank/types";

type DB = Database.Database;
const now = () => new Date().toISOString();

export type PurchaseStatus =
  | "AUTO_APPROVED" | "NEEDS_PARENT_APPROVAL" | "BLOCKED" | "APPROVAL_REQUIRED" | "DECLINED" | "APPROVED"
  | "PAYMENT_READY" | "RESERVED" | "PAYMENT_PENDING" | "PAID" | "FAILED" | "REVERSED";

export type PurchaseRow = {
  id: string; child_id: string; source_url: string | null; extracted_product_json: string | null; offer_id: string;
  merchant_id: string; price_kobo: number; policy_version: number | null; decision: string | null;
  reason_codes: string; status: PurchaseStatus; created_at: string; updated_at: string;
};
type MerchantRow = {
  id: string; display_name: string; forge_merchant_id: string | null; bank_code: string; bank_account_number: string;
  resolved_account_name: string; identity_verification_status: string; active: number;
};
type OfferRow = { id: string; merchant_id: string; title: string; category: string; price_kobo: number; status: string };
type AttemptRow = {
  id: string; purchase_request_id: string; mode: "TRANSFER" | "CHECKOUT"; bank_reference: string; idempotency_key: string;
  name_enquiry_ref: string | null; amount_kobo: number; bank_status: string; payment_url: string | null; created_at: string;
};
type ApprovalRow = {
  decision: string; method: string | null; approved_amount_kobo: number; approved_merchant_id: string;
  approved_offer_id: string; approved_beneficiary_fingerprint: string; expires_at: string; used_at: string | null;
};

export class PurchaseError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

export const fingerprint = (m: { bank_code: string; bank_account_number: string }) => `${m.bank_code}:${m.bank_account_number}`;

export function audit(db: DB, actor: string, event: string, opts: { childId?: string; purchaseId?: string; detail?: unknown } = {}) {
  db.prepare("INSERT INTO audit_events (child_id, purchase_request_id, actor, event, detail, created_at) VALUES (?,?,?,?,?,?)").run(
    opts.childId ?? null, opts.purchaseId ?? null, actor, event, opts.detail === undefined ? null : JSON.stringify(opts.detail), now(),
  );
}

export function activePolicy(db: DB, childId: string): (PolicyFacts & { id: string }) | null {
  const p = db
    .prepare("SELECT * FROM policies WHERE child_id = ? AND status = 'ACTIVE' ORDER BY version DESC LIMIT 1")
    .get(childId) as { id: string; version: number; status: string; maximum_single_purchase_kobo: number; daily_limit_kobo: number; expires_at: string } | undefined;
  if (!p) return null;
  const merchants = db.prepare("SELECT merchant_id, beneficiary_fingerprint FROM policy_merchants WHERE policy_id = ?").all(p.id) as { merchant_id: string; beneficiary_fingerprint: string }[];
  const categories = db.prepare("SELECT category FROM policy_categories WHERE policy_id = ?").all(p.id) as { category: string }[];
  return {
    id: p.id,
    version: p.version,
    status: p.status,
    maximumSinglePurchaseKobo: p.maximum_single_purchase_kobo,
    dailyLimitKobo: p.daily_limit_kobo,
    expiresAt: p.expires_at,
    merchants: merchants.map((m) => ({ merchantId: m.merchant_id, beneficiaryFingerprint: m.beneficiary_fingerprint })),
    categories: categories.map((c) => c.category),
  };
}

// Allowance spending committed today (reserved, pending or paid), in UTC days.
function spentTodayKobo(db: DB, childId: string, excludeId?: string) {
  const r = db.prepare(
    `SELECT COALESCE(SUM(p.price_kobo),0) AS t FROM purchase_requests p JOIN payment_attempts a ON a.purchase_request_id = p.id
     WHERE p.child_id = ? AND a.mode = 'TRANSFER' AND p.status IN ('RESERVED','PAYMENT_PENDING','PAID')
     AND substr(a.created_at,1,10) = substr(?,1,10) AND p.id != ?`,
  ).get(childId, now(), excludeId ?? "") as { t: number };
  return r.t;
}

const getPurchase = (db: DB, id: string) => db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id) as PurchaseRow | undefined;
const getMerchant = (db: DB, id: string) => db.prepare("SELECT * FROM merchants WHERE id = ?").get(id) as MerchantRow;
const getOffer = (db: DB, id: string) => db.prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow | undefined;
const getAttempt = (db: DB, purchaseId: string) => db.prepare("SELECT * FROM payment_attempts WHERE purchase_request_id = ?").get(purchaseId) as AttemptRow | undefined;
const getApproval = (db: DB, purchaseId: string) => db.prepare("SELECT * FROM approvals WHERE purchase_request_id = ?").get(purchaseId) as ApprovalRow | undefined;

function setStatus(db: DB, id: string, status: PurchaseStatus, extra: Partial<Pick<PurchaseRow, "decision" | "reason_codes" | "policy_version">> = {}) {
  db.prepare(
    "UPDATE purchase_requests SET status = ?, decision = COALESCE(?, decision), reason_codes = COALESCE(?, reason_codes), policy_version = COALESCE(?, policy_version), updated_at = ? WHERE id = ?",
  ).run(status, extra.decision ?? null, extra.reason_codes ?? null, extra.policy_version ?? null, now(), id);
}

function evaluateFor(db: DB, childId: string, offer: OfferRow, purchaseId?: string, useAllowanceApproval = false): EvaluationResult {
  const merchant = getMerchant(db, offer.merchant_id);
  const approval = purchaseId && useAllowanceApproval ? getApproval(db, purchaseId) : undefined;
  return evaluate({
    policy: activePolicy(db, childId),
    merchant: {
      id: merchant.id,
      active: !!merchant.active,
      verified: merchant.identity_verification_status === "VERIFIED",
      beneficiaryFingerprint: fingerprint(merchant),
    },
    offer: { id: offer.id, confirmed: offer.status === "CONFIRMED", category: offer.category, priceKobo: offer.price_kobo },
    availableKobo: balances(db, childId).availableKobo,
    spentTodayKobo: spentTodayKobo(db, childId, purchaseId),
    approval:
      approval && approval.decision === "APPROVE" && approval.method === "ALLOWANCE" && !approval.used_at
        ? {
            offerId: approval.approved_offer_id,
            merchantId: approval.approved_merchant_id,
            amountKobo: approval.approved_amount_kobo,
            beneficiaryFingerprint: approval.approved_beneficiary_fingerprint,
            expiresAt: approval.expires_at,
          }
        : null,
  });
}

export function createPurchase(db: DB, childId: string, offerId: string, source: { url?: string; extracted?: unknown }) {
  const offer = getOffer(db, offerId);
  if (!offer) throw new PurchaseError("OFFER_NOT_FOUND", "That offer doesn't exist", 404);
  const result = evaluateFor(db, childId, offer);
  const id = `pr_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  db.prepare("INSERT INTO purchase_requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    id, childId, source.url ?? null, source.extracted ? JSON.stringify(source.extracted) : null, offer.id, offer.merchant_id,
    offer.price_kobo, result.policyVersion, result.decision, JSON.stringify(result.reasons), result.decision, now(), now(),
  );
  audit(db, childId, "PURCHASE_EVALUATED", { childId, purchaseId: id, detail: result });
  return { id, ...result };
}

export function requestApproval(db: DB, purchaseId: string, childId: string) {
  const p = getPurchase(db, purchaseId);
  if (!p || p.child_id !== childId) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
  if (p.status !== "NEEDS_PARENT_APPROVAL") throw new PurchaseError("INVALID_STATE", "This purchase doesn't need approval", 409);
  setStatus(db, purchaseId, "APPROVAL_REQUIRED");
  audit(db, childId, "APPROVAL_REQUESTED", { childId, purchaseId });
}

export function decide(db: DB, purchaseId: string, guardian: { id: string; familyId: string }, decision: "APPROVE" | "DECLINE", method: "CHECKOUT" | "ALLOWANCE" = "CHECKOUT") {
  return db.transaction(() => {
    const p = getPurchase(db, purchaseId);
    if (!p || !sameFamily(db, p.child_id, guardian.familyId)) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
    if (p.status !== "APPROVAL_REQUIRED") throw new PurchaseError("INVALID_STATE", "This request is no longer waiting for you", 409);
    const merchant = getMerchant(db, p.merchant_id);
    const offer = getOffer(db, p.offer_id)!;
    // Hard blocks can't be approved away, and the offer must still match what the child asked for.
    if (merchant.identity_verification_status !== "VERIFIED" || offer.status !== "CONFIRMED") {
      throw new PurchaseError("NOT_APPROVABLE", "This seller isn't verified, so it can't be approved", 409);
    }
    if (offer.price_kobo !== p.price_kobo) throw new PurchaseError("OFFER_CHANGED", "The price changed since the request; ask again", 409);

    db.prepare("INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      randomUUID(), purchaseId, guardian.id, decision, decision === "APPROVE" ? method : null, p.price_kobo, merchant.id, offer.id,
      fingerprint(merchant), p.policy_version, new Date(Date.now() + 24 * 3600_000).toISOString(), null, now(),
    );
    setStatus(db, purchaseId, decision === "APPROVE" ? "APPROVED" : "DECLINED");
    audit(db, guardian.id, decision === "APPROVE" ? "PARENT_APPROVED" : "PARENT_DECLINED", { childId: p.child_id, purchaseId, detail: { method } });
  })();
}

function sameFamily(db: DB, childId: string, familyId: string) {
  return !!db.prepare("SELECT 1 FROM users WHERE id = ? AND family_id = ?").get(childId, familyId);
}

// Pay from the pre-funded allowance by intrabank transfer to the merchant's registered settlement account.
export async function executeTransfer(db: DB, bank: BankClient, purchaseId: string, actor: { id: string; familyId: string }, sourceAccount: string, testOutcome?: TestOutcome) {
  // Step 1, atomic: re-evaluate, reserve funds and claim the single payment attempt.
  const claim = db.transaction(() => {
    const p = getPurchase(db, purchaseId);
    if (!p || !sameFamily(db, p.child_id, actor.familyId)) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
    if (getAttempt(db, purchaseId)) throw new PurchaseError("ALREADY_EXECUTED", "This purchase is already being paid", 409);
    const allowanceException = p.status === "APPROVED" && getApproval(db, purchaseId)?.method === "ALLOWANCE";
    if (p.status !== "AUTO_APPROVED" && !allowanceException) {
      throw new PurchaseError("NOT_AUTHORIZED", "This purchase isn't authorized for automatic payment", 403);
    }
    const offer = getOffer(db, p.offer_id)!;
    if (offer.price_kobo !== p.price_kobo) throw new PurchaseError("OFFER_CHANGED", "The price changed; check the item again", 409);
    const result = evaluateFor(db, p.child_id, offer, purchaseId, allowanceException);
    if (result.decision !== "AUTO_APPROVED") {
      setStatus(db, purchaseId, result.decision, { decision: result.decision, reason_codes: JSON.stringify(result.reasons), policy_version: result.policyVersion ?? undefined });
      return { ok: false as const, result };
    }
    const merchant = getMerchant(db, p.merchant_id);
    const reference = `LP-${purchaseId}`;
    post(db, p.child_id, "RESERVE", reference, p.price_kobo);
    db.prepare(
      "INSERT INTO payment_attempts (id, purchase_request_id, mode, bank_reference, idempotency_key, source_account, destination_account, amount_kobo, bank_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(randomUUID(), purchaseId, "TRANSFER", reference, randomUUID(), sourceAccount, merchant.bank_account_number, p.price_kobo, "CREATED", now());
    if (allowanceException) db.prepare("UPDATE approvals SET used_at = ? WHERE purchase_request_id = ?").run(now(), purchaseId);
    setStatus(db, purchaseId, "RESERVED", { reason_codes: JSON.stringify(result.reasons) });
    audit(db, actor.id, "FUNDS_RESERVED", { childId: p.child_id, purchaseId, detail: { amount_kobo: p.price_kobo } });
    return { ok: true as const, purchase: p, merchant, reference };
  }).immediate();

  if (!claim.ok) return { status: getPurchase(db, purchaseId)!.status, result: claim.result };
  const { purchase, merchant, reference } = claim;
  const attempt = getAttempt(db, purchaseId)!;

  // Step 2: name enquiry. Nothing has been sent yet, so a failure here safely releases the reservation.
  let ne;
  try {
    ne = await bank.intraNameEnquiry(merchant.bank_account_number);
  } catch (e) {
    finalize(db, purchaseId, "failed", e instanceof BankError ? `${e.code}: ${e.message}` : String(e));
    return { status: getPurchase(db, purchaseId)!.status };
  }
  if (normalizeName(ne.accountName) !== normalizeName(merchant.resolved_account_name)) {
    finalize(db, purchaseId, "failed", `BENEFICIARY_NAME_MISMATCH: bank returned ${ne.accountName}`);
    return { status: getPurchase(db, purchaseId)!.status };
  }
  db.prepare("UPDATE payment_attempts SET name_enquiry_ref = ? WHERE id = ?").run(ne.nameEnquiryRef, attempt.id);

  // Step 3: send once. Unknown outcomes stay pending and are resolved by requery, never by resending.
  try {
    const t = await bank.intraTransfer(
      {
        sourceAccount,
        destinationAccount: merchant.bank_account_number,
        nameEnquiryRef: ne.nameEnquiryRef,
        amountKobo: purchase.price_kobo,
        narration: `LinkPass ${purchaseId}`,
        reference,
      },
      attempt.idempotency_key,
      testOutcome,
    );
    db.prepare("UPDATE payment_attempts SET total_debit_kobo = ? WHERE id = ?").run(t.totalDebitKobo, attempt.id);
    finalize(db, purchaseId, t.status);
  } catch (e) {
    const err = e instanceof BankError ? e : new BankError("NETWORK_ERROR", String(e), 0);
    if (err.outcomeUnknown) {
      db.prepare("UPDATE payment_attempts SET bank_status = 'unknown', last_error = ? WHERE id = ?").run(`${err.code}: ${err.message}`, attempt.id);
      setStatus(db, purchaseId, "PAYMENT_PENDING");
      audit(db, "bank", "TRANSFER_OUTCOME_UNKNOWN", { childId: purchase.child_id, purchaseId, detail: { code: err.code } });
    } else {
      finalize(db, purchaseId, "failed", `${err.code}: ${err.message}`);
    }
  }
  return { status: getPurchase(db, purchaseId)!.status };
}

const normalizeName = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

// Apply a bank-confirmed transfer status. Safe to call repeatedly (webhooks, polling, replays).
export function finalize(db: DB, purchaseId: string, status: TransferStatus, error?: string) {
  db.transaction(() => {
    const p = getPurchase(db, purchaseId)!;
    const a = getAttempt(db, purchaseId)!;
    const ref = a.bank_reference;
    db.prepare("UPDATE payment_attempts SET bank_status = ?, last_error = COALESCE(?, last_error), finalized_at = CASE WHEN ? = 'pending' THEN finalized_at ELSE ? END WHERE id = ?")
      .run(status, error ?? null, status, now(), a.id);
    const open = p.status === "RESERVED" || p.status === "PAYMENT_PENDING";
    if (status === "pending" && open) {
      setStatus(db, purchaseId, "PAYMENT_PENDING");
    } else if (status === "successful" && open) {
      post(db, p.child_id, "SETTLE", ref, p.price_kobo);
      setStatus(db, purchaseId, "PAID");
      audit(db, "bank", "PAYMENT_CONFIRMED", { childId: p.child_id, purchaseId, detail: { reference: ref } });
    } else if (status === "failed" && open) {
      post(db, p.child_id, "RELEASE", ref, p.price_kobo);
      setStatus(db, purchaseId, "FAILED");
      audit(db, "bank", "PAYMENT_FAILED", { childId: p.child_id, purchaseId, detail: { reference: ref, error } });
    } else if (status === "reversed" && (open || p.status === "PAID")) {
      // The bank reports the debit returned to source; only now does the allowance come back.
      if (p.status === "PAID" && !hasPosted(db, "REVERSE", ref)) post(db, p.child_id, "REVERSE", ref, p.price_kobo);
      if (open) post(db, p.child_id, "RELEASE", ref, p.price_kobo);
      setStatus(db, purchaseId, "REVERSED");
      audit(db, "bank", "PAYMENT_REVERSED", { childId: p.child_id, purchaseId, detail: { reference: ref } });
    }
  }).immediate();
}

export async function startCheckout(db: DB, bank: BankClient, purchaseId: string, guardian: { id: string; familyId: string }, callbackBase: string) {
  const p = getPurchase(db, purchaseId);
  if (!p || !sameFamily(db, p.child_id, guardian.familyId)) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
  const existing = getAttempt(db, purchaseId);
  if (existing?.mode === "CHECKOUT" && existing.payment_url) return { paymentUrl: existing.payment_url };
  const approval = getApproval(db, purchaseId);
  if (p.status !== "APPROVED" || approval?.method !== "CHECKOUT") throw new PurchaseError("NOT_APPROVED", "Approve this purchase first", 409);
  const merchant = getMerchant(db, p.merchant_id);
  if (!merchant.forge_merchant_id) throw new PurchaseError("NO_CHECKOUT", "This seller can't take checkout payments", 409);
  const offer = getOffer(db, p.offer_id)!;
  const reference = `LPC-${purchaseId}`;
  const key = randomUUID();
  db.prepare(
    "INSERT INTO payment_attempts (id, purchase_request_id, mode, bank_reference, idempotency_key, amount_kobo, bank_status, created_at) VALUES (?,?,?,?,?,?,?,?)",
  ).run(randomUUID(), purchaseId, "CHECKOUT", reference, key, p.price_kobo, "CREATED", now());
  const c = await bank.createCheckout(
    {
      merchantId: merchant.forge_merchant_id,
      amountKobo: p.price_kobo,
      description: offer.title,
      reference,
      callbackUrl: `${callbackBase}/parent/checkout-return?purchase=${purchaseId}`,
      customer: { name: "Adaeze Okonkwo", email: "adaeze@example.ng" },
    },
    key,
  );
  db.prepare("UPDATE payment_attempts SET payment_url = ?, bank_status = ? WHERE purchase_request_id = ?").run(c.paymentUrl, c.status, purchaseId);
  setStatus(db, purchaseId, "PAYMENT_READY");
  audit(db, guardian.id, "CHECKOUT_CREATED", { childId: p.child_id, purchaseId, detail: { reference } });
  return { paymentUrl: c.paymentUrl };
}

// Ask the bank for the true state of an open payment. A callback or redirect alone never marks anything paid.
export async function refresh(db: DB, bank: BankClient, purchaseId: string) {
  const p = getPurchase(db, purchaseId);
  const a = getAttempt(db, purchaseId);
  if (!p || !a) return;
  try {
    if (a.mode === "TRANSFER" && (p.status === "PAYMENT_PENDING" || p.status === "RESERVED")) {
      const t = await bank.getTransfer(a.bank_reference);
      finalize(db, purchaseId, t.status);
    } else if (a.mode === "CHECKOUT" && p.status === "PAYMENT_READY") {
      const v = await bank.verifyPayment(a.bank_reference);
      db.prepare("UPDATE payment_attempts SET bank_status = ? WHERE id = ?").run(v.status, a.id);
      if ((v.status === "successful" || v.status === "overpaid") && v.amountPaidKobo >= p.price_kobo) {
        db.prepare("UPDATE payment_attempts SET finalized_at = ? WHERE id = ?").run(now(), a.id);
        setStatus(db, purchaseId, "PAID");
        audit(db, "bank", "PAYMENT_CONFIRMED", { childId: p.child_id, purchaseId, detail: { reference: a.bank_reference } });
      } else if (v.status === "failed" || v.status === "expired") {
        setStatus(db, purchaseId, "FAILED");
        audit(db, "bank", "PAYMENT_FAILED", { childId: p.child_id, purchaseId, detail: { reference: a.bank_reference, status: v.status } });
      }
    }
  } catch (e) {
    // Leave state untouched; the next poll or webhook tries again.
    if (!(e instanceof BankError)) throw e;
  }
}

// Credit the allowance only after the bank confirms the controlled source holds enough to back every entitlement.
export async function fundAllowance(db: DB, bank: BankClient, childId: string, guardianId: string, amountKobo: number, sourceAccount: string) {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0 || amountKobo > 50_000_000) throw new PurchaseError("INVALID_AMOUNT", "Enter an amount between ₦1 and ₦500,000");
  const bal = await bank.getBalance(sourceAccount);
  return db.transaction(() => {
    const committed = outstandingEntitlementsKobo(db);
    if (committed + amountKobo > bal.availableKobo) {
      throw new PurchaseError("UNBACKED", "The controlled account doesn't hold enough to back this allowance", 409);
    }
    const id = randomUUID();
    db.prepare("INSERT INTO funding_events VALUES (?,?,?,?,?,?,?,?)").run(id, childId, amountKobo, sourceAccount, bal.availableKobo, bal.requestId ?? null, "VERIFIED", now());
    post(db, childId, "FUND", id, amountKobo);
    audit(db, guardianId, "ALLOWANCE_FUNDED", { childId, detail: { amount_kobo: amountKobo, bank_available_kobo: bal.availableKobo } });
    return balances(db, childId);
  }).immediate();
}

export function savePolicy(
  db: DB,
  guardian: { id: string; familyId: string },
  childId: string,
  input: { maximumSinglePurchaseKobo: number; dailyLimitKobo: number; merchantIds: string[]; categories: string[]; expiresAt: string },
) {
  return db.transaction(() => {
    if (!sameFamily(db, childId, guardian.familyId)) throw new PurchaseError("NOT_FOUND", "Child not found", 404);
    const last = db.prepare("SELECT COALESCE(MAX(version),0) AS v FROM policies WHERE child_id = ?").get(childId) as { v: number };
    db.prepare("UPDATE policies SET status = 'SUPERSEDED' WHERE child_id = ? AND status = 'ACTIVE'").run(childId);
    const id = `pol_${randomUUID().slice(0, 8)}`;
    const version = last.v + 1;
    db.prepare("INSERT INTO policies VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      id, guardian.familyId, childId, version, "ACTIVE", input.maximumSinglePurchaseKobo, input.dailyLimitKobo, input.expiresAt, guardian.id, now(),
    );
    for (const mId of input.merchantIds) {
      const m = getMerchant(db, mId);
      if (!m || m.identity_verification_status !== "VERIFIED") throw new PurchaseError("MERCHANT_UNVERIFIED", "Only verified merchants can be approved");
      db.prepare("INSERT INTO policy_merchants VALUES (?,?,?)").run(id, mId, fingerprint(m));
    }
    for (const c of input.categories) db.prepare("INSERT INTO policy_categories VALUES (?,?)").run(id, c);
    audit(db, guardian.id, "POLICY_ACTIVATED", { childId, detail: { version, ...input } });
    return version;
  })();
}

export function revokePolicy(db: DB, guardian: { id: string; familyId: string }, childId: string) {
  if (!sameFamily(db, childId, guardian.familyId)) throw new PurchaseError("NOT_FOUND", "Child not found", 404);
  db.prepare("UPDATE policies SET status = 'REVOKED' WHERE child_id = ? AND status = 'ACTIVE'").run(childId);
  audit(db, guardian.id, "POLICY_REVOKED", { childId });
}

export { getPurchase, getAttempt };
