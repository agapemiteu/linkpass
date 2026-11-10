// Deterministic permission engine. No AI input reaches this file; it only sees database facts.

export type Decision = "AUTO_APPROVED" | "NEEDS_PARENT_APPROVAL" | "BLOCKED";

export type ReasonCode =
  | "MERCHANT_APPROVED"
  | "CATEGORY_ALLOWED"
  | "WITHIN_SINGLE_LIMIT"
  | "WITHIN_DAILY_LIMIT"
  | "WITHIN_AVAILABLE_ALLOWANCE"
  | "PARENT_APPROVED_EXCEPTION"
  | "NO_ACTIVE_POLICY"
  | "POLICY_EXPIRED"
  | "MERCHANT_NOT_APPROVED"
  | "CATEGORY_NOT_ALLOWED"
  | "ABOVE_SINGLE_LIMIT"
  | "ABOVE_DAILY_LIMIT"
  | "INSUFFICIENT_ALLOWANCE"
  | "MERCHANT_UNVERIFIED"
  | "BENEFICIARY_MISMATCH"
  | "OFFER_UNCONFIRMED"
  | "CATEGORY_PROHIBITED";

export const PROHIBITED_CATEGORIES = ["alcohol", "tobacco", "gambling", "weapons", "adult", "cash"];

export type PolicyFacts = {
  version: number;
  status: string;
  maximumSinglePurchaseKobo: number;
  dailyLimitKobo: number;
  expiresAt: string;
  categories: string[];
  merchants: { merchantId: string; beneficiaryFingerprint: string }[];
};

export type EvaluationInput = {
  policy: PolicyFacts | null;
  merchant: { id: string; active: boolean; verified: boolean; beneficiaryFingerprint: string };
  offer: { id: string; confirmed: boolean; category: string; priceKobo: number };
  availableKobo: number;
  spentTodayKobo: number;
  // A guardian approval bound to this exact purchase may lift parent-configurable limits, never hard blocks.
  approval?: { offerId: string; merchantId: string; amountKobo: number; beneficiaryFingerprint: string; expiresAt: string } | null;
  now?: Date;
};

export type EvaluationResult = {
  decision: Decision;
  policyVersion: number | null;
  reasons: ReasonCode[];
};

const HARD: ReasonCode[] = ["MERCHANT_UNVERIFIED", "BENEFICIARY_MISMATCH", "OFFER_UNCONFIRMED", "CATEGORY_PROHIBITED"];
const PASS: ReasonCode[] = [
  "MERCHANT_APPROVED", "CATEGORY_ALLOWED", "WITHIN_SINGLE_LIMIT", "WITHIN_DAILY_LIMIT",
  "WITHIN_AVAILABLE_ALLOWANCE", "PARENT_APPROVED_EXCEPTION",
];

export function evaluate(input: EvaluationInput): EvaluationResult {
  const { policy, merchant, offer } = input;
  const now = input.now ?? new Date();
  const reasons: ReasonCode[] = [];

  // Hard safety rules: nothing a parent taps can override these.
  if (!offer.confirmed) reasons.push("OFFER_UNCONFIRMED");
  if (!merchant.active || !merchant.verified) reasons.push("MERCHANT_UNVERIFIED");
  if (PROHIBITED_CATEGORIES.includes(offer.category)) reasons.push("CATEGORY_PROHIBITED");
  const approvedMerchant = policy?.merchants.find((m) => m.merchantId === merchant.id);
  if (approvedMerchant && approvedMerchant.beneficiaryFingerprint !== merchant.beneficiaryFingerprint) {
    reasons.push("BENEFICIARY_MISMATCH");
  }

  const approval = input.approval;
  const approvalValid =
    !!approval &&
    approval.offerId === offer.id &&
    approval.merchantId === merchant.id &&
    approval.amountKobo === offer.priceKobo &&
    approval.beneficiaryFingerprint === merchant.beneficiaryFingerprint &&
    new Date(approval.expiresAt) > now;

  if (!policy || policy.status !== "ACTIVE") {
    reasons.push("NO_ACTIVE_POLICY");
  } else if (new Date(policy.expiresAt) <= now) {
    reasons.push("POLICY_EXPIRED");
  } else {
    if (approvalValid) {
      reasons.push("PARENT_APPROVED_EXCEPTION");
    } else {
      reasons.push(approvedMerchant ? "MERCHANT_APPROVED" : "MERCHANT_NOT_APPROVED");
      reasons.push(policy.categories.includes(offer.category) ? "CATEGORY_ALLOWED" : "CATEGORY_NOT_ALLOWED");
      reasons.push(offer.priceKobo <= policy.maximumSinglePurchaseKobo ? "WITHIN_SINGLE_LIMIT" : "ABOVE_SINGLE_LIMIT");
      reasons.push(
        input.spentTodayKobo + offer.priceKobo <= policy.dailyLimitKobo ? "WITHIN_DAILY_LIMIT" : "ABOVE_DAILY_LIMIT",
      );
    }
  }
  // Funds are checked even with a parent exception: approval never creates money.
  reasons.push(offer.priceKobo <= input.availableKobo ? "WITHIN_AVAILABLE_ALLOWANCE" : "INSUFFICIENT_ALLOWANCE");

  let decision: Decision = "AUTO_APPROVED";
  if (reasons.some((r) => HARD.includes(r))) decision = "BLOCKED";
  else if (reasons.some((r) => !PASS.includes(r))) decision = "NEEDS_PARENT_APPROVAL";

  return { decision, policyVersion: policy?.version ?? null, reasons };
}

// Human copy is derived only from the codes the engine produced.
export const REASON_TEXT: Record<ReasonCode, string> = {
  MERCHANT_APPROVED: "Seller is on your approved list",
  CATEGORY_ALLOWED: "Category is allowed",
  WITHIN_SINGLE_LIMIT: "Within the per-purchase limit",
  WITHIN_DAILY_LIMIT: "Within today's limit",
  WITHIN_AVAILABLE_ALLOWANCE: "Allowance covers it",
  PARENT_APPROVED_EXCEPTION: "Parent approved this exact purchase",
  NO_ACTIVE_POLICY: "No active shopping permissions",
  POLICY_EXPIRED: "Permissions have expired",
  MERCHANT_NOT_APPROVED: "Seller isn't on the approved list",
  CATEGORY_NOT_ALLOWED: "Category isn't allowed",
  ABOVE_SINGLE_LIMIT: "Above the per-purchase limit",
  ABOVE_DAILY_LIMIT: "Would exceed today's limit",
  INSUFFICIENT_ALLOWANCE: "Not enough allowance left",
  MERCHANT_UNVERIFIED: "Seller isn't a verified LinkPass merchant",
  BENEFICIARY_MISMATCH: "Seller's bank account doesn't match the approved one",
  OFFER_UNCONFIRMED: "Price couldn't be confirmed with the seller",
  CATEGORY_PROHIBITED: "This category is never allowed",
};

export const isPassing = (r: ReasonCode) => PASS.includes(r);
