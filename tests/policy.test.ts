import { describe, expect, it } from "vitest";
import { evaluate, type EvaluationInput } from "@/lib/policies/evaluator";

const base = (): EvaluationInput => ({
  policy: {
    version: 1,
    status: "ACTIVE",
    maximumSinglePurchaseKobo: 2_000_000,
    dailyLimitKobo: 4_000_000,
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    categories: ["clothing", "footwear"],
    merchants: [{ merchantId: "mer_206", beneficiaryFingerprint: "000014:0123456790" }],
  },
  merchant: { id: "mer_206", active: true, verified: true, beneficiaryFingerprint: "000014:0123456790" },
  offer: { id: "off_sneaker", confirmed: true, category: "footwear", priceKobo: 1_500_000 },
  availableKobo: 5_000_000,
  spentTodayKobo: 0,
});

describe("policy engine", () => {
  it("auto-approves an eligible purchase", () => {
    const r = evaluate(base());
    expect(r.decision).toBe("AUTO_APPROVED");
    expect(r.reasons).toContain("MERCHANT_APPROVED");
  });

  it("asks the parent above the single-purchase limit", () => {
    const i = base();
    i.offer.priceKobo = 3_500_000;
    const r = evaluate(i);
    expect(r.decision).toBe("NEEDS_PARENT_APPROVAL");
    expect(r.reasons).toContain("ABOVE_SINGLE_LIMIT");
  });

  it("asks the parent for an unapproved verified seller", () => {
    const i = base();
    i.merchant = { id: "mer_204", active: true, verified: true, beneficiaryFingerprint: "000014:0123456793" };
    expect(evaluate(i).reasons).toContain("MERCHANT_NOT_APPROVED");
  });

  it("blocks an unverified seller", () => {
    const i = base();
    i.merchant = { id: "unv_001", active: true, verified: false, beneficiaryFingerprint: "000013:0123987001" };
    expect(evaluate(i).decision).toBe("BLOCKED");
  });

  it("blocks when an approved merchant's account changed", () => {
    const i = base();
    i.merchant.beneficiaryFingerprint = "000013:0123987001";
    const r = evaluate(i);
    expect(r.decision).toBe("BLOCKED");
    expect(r.reasons).toContain("BENEFICIARY_MISMATCH");
  });

  it("blocks prohibited categories", () => {
    const i = base();
    i.offer.category = "alcohol";
    expect(evaluate(i).decision).toBe("BLOCKED");
  });

  it("blocks unconfirmed offers", () => {
    const i = base();
    i.offer.confirmed = false;
    expect(evaluate(i).decision).toBe("BLOCKED");
  });

  it("does not auto-approve with an expired or revoked policy", () => {
    const i = base();
    i.policy!.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(evaluate(i).reasons).toContain("POLICY_EXPIRED");
    const j = base();
    j.policy!.status = "REVOKED";
    expect(evaluate(j).decision).toBe("NEEDS_PARENT_APPROVAL");
  });

  it("respects the daily limit", () => {
    const i = base();
    i.spentTodayKobo = 3_000_000;
    expect(evaluate(i).reasons).toContain("ABOVE_DAILY_LIMIT");
  });

  it("needs funds even with a parent exception", () => {
    const i = base();
    i.offer.priceKobo = 3_500_000;
    i.availableKobo = 1_000_000;
    i.approval = { offerId: "off_sneaker", merchantId: "mer_206", amountKobo: 3_500_000, beneficiaryFingerprint: "000014:0123456790", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    const r = evaluate(i);
    expect(r.reasons).toContain("PARENT_APPROVED_EXCEPTION");
    expect(r.decision).toBe("NEEDS_PARENT_APPROVAL");
  });

  it("an approval for a different amount or account does not apply", () => {
    const i = base();
    i.offer.priceKobo = 3_500_000;
    i.approval = { offerId: "off_sneaker", merchantId: "mer_206", amountKobo: 3_000_000, beneficiaryFingerprint: "000014:0123456790", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    expect(evaluate(i).reasons).toContain("ABOVE_SINGLE_LIMIT");
  });
});
