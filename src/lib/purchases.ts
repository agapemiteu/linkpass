import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { evaluate, type EvaluationResult, type PolicyFacts } from "./policies/evaluator";
import { balances, hasPosted, outstandingEntitlementsKobo, post } from "./finance/ledger";
import { BankError, type BankClient, type TestOutcome, type TransferStatus } from "./bank/types";

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

export async function audit(db: Db, actor: string, event: string, opts: { childId?: string; purchaseId?: string; detail?: unknown } = {}) {
  await db.run(
    "INSERT INTO audit_events (child_id, purchase_request_id, actor, event, detail, created_at) VALUES (?,?,?,?,?,?)",
    opts.childId ?? null, opts.purchaseId ?? null, actor, event, opts.detail === undefined ? null : JSON.stringify(opts.detail), now(),
  );
}

export async function activePolicy(db: Db, childId: string): Promise<(PolicyFacts & { id: string }) | null> {
  const p = await db.get<{ id: string; version: number; status: string; maximum_single_purchase_kobo: number; daily_limit_kobo: number; expires_at: string }>(
    "SELECT * FROM policies WHERE child_id = ? AND status = 'ACTIVE' ORDER BY version DESC LIMIT 1", childId,
  );
  if (!p) return null;
  const merchants = await db.all<{ merchant_id: string; beneficiary_fingerprint: string }>("SELECT merchant_id, beneficiary_fingerprint FROM policy_merchants WHERE policy_id = ?", p.id);
  const categories = await db.all<{ category: string }>("SELECT category FROM policy_categories WHERE policy_id = ?", p.id);
  return {
    id: p.id,
    version: Number(p.version),
    status: p.status,
    maximumSinglePurchaseKobo: Number(p.maximum_single_purchase_kobo),
    dailyLimitKobo: Number(p.daily_limit_kobo),
    expiresAt: p.expires_at,
    merchants: merchants.map((m) => ({ merchantId: m.merchant_id, beneficiaryFingerprint: m.beneficiary_fingerprint })),
    categories: categories.map((c) => c.category),
  };
}

// Allowance spending committed today (reserved, pending or paid), in UTC days.
async function spentTodayKobo(db: Db, childId: string, excludeId?: string) {
  const r = await db.get<{ t: number }>(
    `SELECT COALESCE(SUM(p.price_kobo),0) AS t FROM purchase_requests p JOIN payment_attempts a ON a.purchase_request_id = p.id
     WHERE p.child_id = ? AND a.mode = 'TRANSFER' AND p.status IN ('RESERVED','PAYMENT_PENDING','PAID')
     AND substr(a.created_at,1,10) = substr(?,1,10) AND p.id != ?`,
    childId, now(), excludeId ?? "",
  );
  return Number(r?.t ?? 0);
}

const getPurchase = (db: Db, id: string) => db.get<PurchaseRow>("SELECT * FROM purchase_requests WHERE id = ?", id);
const getMerchant = async (db: Db, id: string) => (await db.get<MerchantRow>("SELECT * FROM merchants WHERE id = ?", id))!;
const getOffer = (db: Db, id: string) => db.get<OfferRow>("SELECT * FROM offers WHERE id = ?", id);
const getAttempt = (db: Db, purchaseId: string) => db.get<AttemptRow>("SELECT * FROM payment_attempts WHERE purchase_request_id = ?", purchaseId);
const getApproval = (db: Db, purchaseId: string) => db.get<ApprovalRow>("SELECT * FROM approvals WHERE purchase_request_id = ?", purchaseId);

async function setStatus(db: Db, id: string, status: PurchaseStatus, extra: Partial<Pick<PurchaseRow, "decision" | "reason_codes" | "policy_version">> = {}) {
  await db.run(
    "UPDATE purchase_requests SET status = ?, decision = COALESCE(?, decision), reason_codes = COALESCE(?, reason_codes), policy_version = COALESCE(?, policy_version), updated_at = ? WHERE id = ?",
    status, extra.decision ?? null, extra.reason_codes ?? null, extra.policy_version ?? null, now(), id,
  );
}

async function evaluateFor(db: Db, childId: string, offer: OfferRow, purchaseId?: string, useAllowanceApproval = false): Promise<EvaluationResult> {
  const merchant = await getMerchant(db, offer.merchant_id);
  const approval = purchaseId && useAllowanceApproval ? await getApproval(db, purchaseId) : undefined;
  return evaluate({
    policy: await activePolicy(db, childId),
    merchant: {
      id: merchant.id,
      active: !!Number(merchant.active),
      verified: merchant.identity_verification_status === "VERIFIED",
      beneficiaryFingerprint: fingerprint(merchant),
    },
    offer: { id: offer.id, confirmed: offer.status === "CONFIRMED", category: offer.category, priceKobo: Number(offer.price_kobo) },
    availableKobo: (await balances(db, childId)).availableKobo,
    spentTodayKobo: await spentTodayKobo(db, childId, purchaseId),
    approval:
      approval && approval.decision === "APPROVE" && approval.method === "ALLOWANCE" && !approval.used_at
        ? {
            offerId: approval.approved_offer_id,
            merchantId: approval.approved_merchant_id,
            amountKobo: Number(approval.approved_amount_kobo),
            beneficiaryFingerprint: approval.approved_beneficiary_fingerprint,
            expiresAt: approval.expires_at,
          }
        : null,
  });
}

export async function createPurchase(db: Db, childId: string, offerId: string, source: { url?: string; extracted?: unknown }) {
  const offer = await getOffer(db, offerId);
  if (!offer) throw new PurchaseError("OFFER_NOT_FOUND", "That offer doesn't exist", 404);
  const result = await evaluateFor(db, childId, offer);
  const id = `pr_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await db.run(
    "INSERT INTO purchase_requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id, childId, source.url ?? null, source.extracted ? JSON.stringify(source.extracted) : null, offer.id, offer.merchant_id,
    Number(offer.price_kobo), result.policyVersion, result.decision, JSON.stringify(result.reasons), result.decision, now(), now(),
  );
  await audit(db, childId, "PURCHASE_EVALUATED", { childId, purchaseId: id, detail: result });
  return { id, ...result };
}

export async function requestApproval(db: Db, purchaseId: string, childId: string) {
  const p = await getPurchase(db, purchaseId);
  if (!p || p.child_id !== childId) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
  if (p.status !== "NEEDS_PARENT_APPROVAL") throw new PurchaseError("INVALID_STATE", "This purchase doesn't need approval", 409);
  await setStatus(db, purchaseId, "APPROVAL_REQUIRED");
  await audit(db, childId, "APPROVAL_REQUESTED", { childId, purchaseId });
}

export function decide(db: Db, purchaseId: string, guardian: { id: string; familyId: string }, decision: "APPROVE" | "DECLINE", method: "CHECKOUT" | "ALLOWANCE" = "CHECKOUT") {
  return db.tx(async (t) => {
    const p = await getPurchase(t, purchaseId);
    if (!p || !(await sameFamily(t, p.child_id, guardian.familyId))) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
    if (p.status !== "APPROVAL_REQUIRED") throw new PurchaseError("INVALID_STATE", "This request is no longer waiting for you", 409);
    const merchant = await getMerchant(t, p.merchant_id);
    const offer = (await getOffer(t, p.offer_id))!;
    // Hard blocks can't be approved away, and the offer must still match what the child asked for.
    if (merchant.identity_verification_status !== "VERIFIED" || offer.status !== "CONFIRMED") {
      throw new PurchaseError("NOT_APPROVABLE", "This seller isn't verified, so it can't be approved", 409);
    }
    if (Number(offer.price_kobo) !== Number(p.price_kobo)) throw new PurchaseError("OFFER_CHANGED", "The price changed since the request; ask again", 409);

    await t.run(
      "INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      randomUUID(), purchaseId, guardian.id, decision, decision === "APPROVE" ? method : null, Number(p.price_kobo), merchant.id, offer.id,
      fingerprint(merchant), p.policy_version, new Date(Date.now() + 24 * 3600_000).toISOString(), null, now(),
    );
    await setStatus(t, purchaseId, decision === "APPROVE" ? "APPROVED" : "DECLINED");
    await audit(t, guardian.id, decision === "APPROVE" ? "PARENT_APPROVED" : "PARENT_DECLINED", { childId: p.child_id, purchaseId, detail: { method } });
  });
}

async function sameFamily(db: Db, childId: string, familyId: string) {
  return !!(await db.get("SELECT 1 FROM users WHERE id = ? AND family_id = ?", childId, familyId));
}

// Pay from the pre-funded allowance by intrabank transfer to the merchant's registered settlement account.
export async function executeTransfer(db: Db, bank: BankClient, purchaseId: string, actor: { id: string; familyId: string }, sourceAccount: string, testOutcome?: TestOutcome) {
  // Step 1, atomic: re-evaluate, reserve funds and claim the single payment attempt.
  const claim = await db.tx(async (t) => {
    const p = await getPurchase(t, purchaseId);
    if (!p || !(await sameFamily(t, p.child_id, actor.familyId))) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
    if (await getAttempt(t, purchaseId)) throw new PurchaseError("ALREADY_EXECUTED", "This purchase is already being paid", 409);
    const allowanceException = p.status === "APPROVED" && (await getApproval(t, purchaseId))?.method === "ALLOWANCE";
    if (p.status !== "AUTO_APPROVED" && !allowanceException) {
      throw new PurchaseError("NOT_AUTHORIZED", "This purchase isn't authorized for automatic payment", 403);
    }
    const offer = (await getOffer(t, p.offer_id))!;
    if (Number(offer.price_kobo) !== Number(p.price_kobo)) throw new PurchaseError("OFFER_CHANGED", "The price changed; check the item again", 409);
    const result = await evaluateFor(t, p.child_id, offer, purchaseId, allowanceException);
    if (result.decision !== "AUTO_APPROVED") {
      await setStatus(t, purchaseId, result.decision, { decision: result.decision, reason_codes: JSON.stringify(result.reasons), policy_version: result.policyVersion ?? undefined });
      return { ok: false as const, result };
    }
    const merchant = await getMerchant(t, p.merchant_id);
    const reference = `LP-${purchaseId}`;
    await post(t, p.child_id, "RESERVE", reference, Number(p.price_kobo));
    await t.run(
      "INSERT INTO payment_attempts (id, purchase_request_id, mode, bank_reference, idempotency_key, source_account, destination_account, amount_kobo, bank_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      randomUUID(), purchaseId, "TRANSFER", reference, randomUUID(), sourceAccount, merchant.bank_account_number, Number(p.price_kobo), "CREATED", now(),
    );
    if (allowanceException) await t.run("UPDATE approvals SET used_at = ? WHERE purchase_request_id = ?", now(), purchaseId);
    await setStatus(t, purchaseId, "RESERVED", { reason_codes: JSON.stringify(result.reasons) });
    await audit(t, actor.id, "FUNDS_RESERVED", { childId: p.child_id, purchaseId, detail: { amount_kobo: Number(p.price_kobo) } });
    return { ok: true as const, purchase: p, merchant, reference };
  });

  const status = async () => (await getPurchase(db, purchaseId))!.status;
  if (!claim.ok) return { status: await status(), result: claim.result };
  const { purchase, merchant, reference } = claim;
  const attempt = (await getAttempt(db, purchaseId))!;

  // Step 2: name enquiry. Nothing has been sent yet, so a failure here safely releases the reservation.
  let ne;
  try {
    ne = await bank.intraNameEnquiry(merchant.bank_account_number);
  } catch (e) {
    await finalize(db, purchaseId, "failed", e instanceof BankError ? `${e.code}: ${e.message}` : String(e));
    return { status: await status() };
  }
  if (normalizeName(ne.accountName) !== normalizeName(merchant.resolved_account_name)) {
    await finalize(db, purchaseId, "failed", `BENEFICIARY_NAME_MISMATCH: bank returned ${ne.accountName}`);
    return { status: await status() };
  }
  await db.run("UPDATE payment_attempts SET name_enquiry_ref = ? WHERE id = ?", ne.nameEnquiryRef, attempt.id);

  // Step 3: send once. Unknown outcomes stay pending and are resolved by requery, never by resending.
  try {
    const t = await bank.intraTransfer(
      {
        sourceAccount,
        destinationAccount: merchant.bank_account_number,
        nameEnquiryRef: ne.nameEnquiryRef,
        amountKobo: Number(purchase.price_kobo),
        narration: `LinkPass ${purchaseId}`,
        reference,
      },
      attempt.idempotency_key,
      testOutcome,
    );
    await db.run("UPDATE payment_attempts SET total_debit_kobo = ? WHERE id = ?", t.totalDebitKobo, attempt.id);
    await finalize(db, purchaseId, t.status);
  } catch (e) {
    const err = e instanceof BankError ? e : new BankError("NETWORK_ERROR", String(e), 0);
    if (err.outcomeUnknown) {
      await db.run("UPDATE payment_attempts SET bank_status = 'unknown', last_error = ? WHERE id = ?", `${err.code}: ${err.message}`, attempt.id);
      await setStatus(db, purchaseId, "PAYMENT_PENDING");
      await audit(db, "bank", "TRANSFER_OUTCOME_UNKNOWN", { childId: purchase.child_id, purchaseId, detail: { code: err.code } });
    } else {
      await finalize(db, purchaseId, "failed", `${err.code}: ${err.message}`);
    }
  }
  return { status: await status() };
}

const normalizeName = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

// Apply a bank-confirmed transfer status. Safe to call repeatedly (webhooks, polling, replays).
export function finalize(db: Db, purchaseId: string, status: TransferStatus, error?: string) {
  return db.tx(async (t) => {
    const p = (await getPurchase(t, purchaseId))!;
    const a = (await getAttempt(t, purchaseId))!;
    const ref = a.bank_reference;
    const price = Number(p.price_kobo);
    await t.run(
      "UPDATE payment_attempts SET bank_status = ?, last_error = COALESCE(?, last_error), finalized_at = CASE WHEN ? = 'pending' THEN finalized_at ELSE ? END WHERE id = ?",
      status, error ?? null, status, now(), a.id,
    );
    const open = p.status === "RESERVED" || p.status === "PAYMENT_PENDING";
    if (status === "pending" && open) {
      await setStatus(t, purchaseId, "PAYMENT_PENDING");
    } else if (status === "successful" && open) {
      await post(t, p.child_id, "SETTLE", ref, price);
      await setStatus(t, purchaseId, "PAID");
      await audit(t, "bank", "PAYMENT_CONFIRMED", { childId: p.child_id, purchaseId, detail: { reference: ref } });
    } else if (status === "failed" && open) {
      await post(t, p.child_id, "RELEASE", ref, price);
      await setStatus(t, purchaseId, "FAILED");
      await audit(t, "bank", "PAYMENT_FAILED", { childId: p.child_id, purchaseId, detail: { reference: ref, error } });
    } else if (status === "reversed" && (open || p.status === "PAID")) {
      // The bank reports the debit returned to source; only now does the allowance come back.
      if (p.status === "PAID" && !(await hasPosted(t, "REVERSE", ref))) await post(t, p.child_id, "REVERSE", ref, price);
      if (open) await post(t, p.child_id, "RELEASE", ref, price);
      await setStatus(t, purchaseId, "REVERSED");
      await audit(t, "bank", "PAYMENT_REVERSED", { childId: p.child_id, purchaseId, detail: { reference: ref } });
    }
  });
}

export async function startCheckout(db: Db, bank: BankClient, purchaseId: string, guardian: { id: string; familyId: string }, callbackBase: string) {
  const p = await getPurchase(db, purchaseId);
  if (!p || !(await sameFamily(db, p.child_id, guardian.familyId))) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
  const existing = await getAttempt(db, purchaseId);
  if (existing?.mode === "CHECKOUT" && existing.payment_url) return { paymentUrl: existing.payment_url };
  const approval = await getApproval(db, purchaseId);
  if (p.status !== "APPROVED" || approval?.method !== "CHECKOUT") throw new PurchaseError("NOT_APPROVED", "Approve this purchase first", 409);
  const merchant = await getMerchant(db, p.merchant_id);
  if (!merchant.forge_merchant_id) throw new PurchaseError("NO_CHECKOUT", "This seller can't take checkout payments", 409);
  const offer = (await getOffer(db, p.offer_id))!;
  const reference = `LPC-${purchaseId}`;
  const key = randomUUID();
  await db.run(
    "INSERT INTO payment_attempts (id, purchase_request_id, mode, bank_reference, idempotency_key, amount_kobo, bank_status, created_at) VALUES (?,?,?,?,?,?,?,?)",
    randomUUID(), purchaseId, "CHECKOUT", reference, key, Number(p.price_kobo), "CREATED", now(),
  );
  const c = await bank.createCheckout(
    {
      merchantId: merchant.forge_merchant_id,
      amountKobo: Number(p.price_kobo),
      description: offer.title,
      reference,
      callbackUrl: `${callbackBase}/parent/checkout-return?purchase=${purchaseId}`,
      customer: { name: "Adaeze Okonkwo", email: "adaeze@example.ng" },
    },
    key,
  );
  await db.run("UPDATE payment_attempts SET payment_url = ?, bank_status = ? WHERE purchase_request_id = ?", c.paymentUrl, c.status, purchaseId);
  await setStatus(db, purchaseId, "PAYMENT_READY");
  await audit(db, guardian.id, "CHECKOUT_CREATED", { childId: p.child_id, purchaseId, detail: { reference } });
  return { paymentUrl: c.paymentUrl };
}

// Ask the bank for the true state of an open payment. A callback or redirect alone never marks anything paid.
export async function refresh(db: Db, bank: BankClient, purchaseId: string) {
  const p = await getPurchase(db, purchaseId);
  const a = await getAttempt(db, purchaseId);
  if (!p || !a) return;
  try {
    if (a.mode === "TRANSFER" && (p.status === "PAYMENT_PENDING" || p.status === "RESERVED")) {
      const t = await bank.getTransfer(a.bank_reference);
      await finalize(db, purchaseId, t.status);
    } else if (a.mode === "CHECKOUT" && p.status === "PAYMENT_READY") {
      const v = await bank.verifyPayment(a.bank_reference);
      await db.run("UPDATE payment_attempts SET bank_status = ? WHERE id = ?", v.status, a.id);
      if ((v.status === "successful" || v.status === "overpaid") && v.amountPaidKobo >= Number(p.price_kobo)) {
        await db.run("UPDATE payment_attempts SET finalized_at = ? WHERE id = ?", now(), a.id);
        await setStatus(db, purchaseId, "PAID");
        await audit(db, "bank", "PAYMENT_CONFIRMED", { childId: p.child_id, purchaseId, detail: { reference: a.bank_reference } });
      } else if (v.status === "failed" || v.status === "expired") {
        await setStatus(db, purchaseId, "FAILED");
        await audit(db, "bank", "PAYMENT_FAILED", { childId: p.child_id, purchaseId, detail: { reference: a.bank_reference, status: v.status } });
      }
    }
  } catch (e) {
    // Leave state untouched; the next poll or webhook tries again.
    if (!(e instanceof BankError)) throw e;
  }
}

// Credit the allowance only after the bank confirms the controlled source holds enough to back every entitlement.
export async function fundAllowance(db: Db, bank: BankClient, childId: string, guardianId: string, amountKobo: number, sourceAccount: string) {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0 || amountKobo > 50_000_000) throw new PurchaseError("INVALID_AMOUNT", "Enter an amount between ₦1 and ₦500,000");
  const bal = await bank.getBalance(sourceAccount);
  return db.tx(async (t) => {
    const committed = await outstandingEntitlementsKobo(t);
    if (committed + amountKobo > bal.availableKobo) {
      throw new PurchaseError("UNBACKED", "The controlled account doesn't hold enough to back this allowance", 409);
    }
    const id = randomUUID();
    await t.run("INSERT INTO funding_events VALUES (?,?,?,?,?,?,?,?)", id, childId, amountKobo, sourceAccount, bal.availableKobo, bal.requestId ?? null, "VERIFIED", now());
    await post(t, childId, "FUND", id, amountKobo);
    await audit(t, guardianId, "ALLOWANCE_FUNDED", { childId, detail: { amount_kobo: amountKobo, bank_available_kobo: bal.availableKobo } });
    return balances(t, childId);
  });
}

export function savePolicy(
  db: Db,
  guardian: { id: string; familyId: string },
  childId: string,
  input: { maximumSinglePurchaseKobo: number; dailyLimitKobo: number; merchantIds: string[]; categories: string[]; expiresAt: string },
) {
  return db.tx(async (t) => {
    if (!(await sameFamily(t, childId, guardian.familyId))) throw new PurchaseError("NOT_FOUND", "Child not found", 404);
    const last = await t.get<{ v: number }>("SELECT COALESCE(MAX(version),0) AS v FROM policies WHERE child_id = ?", childId);
    await t.run("UPDATE policies SET status = 'SUPERSEDED' WHERE child_id = ? AND status = 'ACTIVE'", childId);
    const id = `pol_${randomUUID().slice(0, 8)}`;
    const version = Number(last?.v ?? 0) + 1;
    await t.run(
      "INSERT INTO policies VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, guardian.familyId, childId, version, "ACTIVE", input.maximumSinglePurchaseKobo, input.dailyLimitKobo, input.expiresAt, guardian.id, now(),
    );
    for (const mId of input.merchantIds) {
      const m = await t.get<MerchantRow>("SELECT * FROM merchants WHERE id = ?", mId);
      if (!m || m.identity_verification_status !== "VERIFIED") throw new PurchaseError("MERCHANT_UNVERIFIED", "Only verified merchants can be approved");
      await t.run("INSERT INTO policy_merchants VALUES (?,?,?)", id, mId, fingerprint(m));
    }
    for (const c of input.categories) await t.run("INSERT INTO policy_categories VALUES (?,?)", id, c);
    await audit(t, guardian.id, "POLICY_ACTIVATED", { childId, detail: { version, ...input } });
    return version;
  });
}

export async function revokePolicy(db: Db, guardian: { id: string; familyId: string }, childId: string) {
  if (!(await sameFamily(db, childId, guardian.familyId))) throw new PurchaseError("NOT_FOUND", "Child not found", 404);
  await db.run("UPDATE policies SET status = 'REVOKED' WHERE child_id = ? AND status = 'ACTIVE'", childId);
  await audit(db, guardian.id, "POLICY_REVOKED", { childId });
}

export { getPurchase, getAttempt };
