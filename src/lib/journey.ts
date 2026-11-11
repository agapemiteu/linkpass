import type { Step } from "@/components/ui";
import type { ReasonCode } from "@/lib/policies/evaluator";
import { isPassing } from "@/lib/policies/evaluator";
import type { PurchaseCard } from "@/lib/views";

const SELLER_CODES: ReasonCode[] = ["MERCHANT_UNVERIFIED", "BENEFICIARY_MISMATCH", "OFFER_UNCONFIRMED"];
const PAY_OPEN = ["RESERVED", "PAYMENT_PENDING", "PAYMENT_READY"];

// Turns a purchase's real state into the steps shown on screen. No step is shown done unless the data says so.
export function journey(p: PurchaseCard, viewer: "child" | "parent"): Step[] {
  const codes = JSON.parse(p.reason_codes) as ReasonCode[];
  const sellerBad = codes.some((c) => SELLER_CODES.includes(c));
  const rulesFailed = codes.filter((c) => !isPassing(c) && !SELLER_CODES.includes(c));
  const needsParent = !!p.approval_method || ["NEEDS_PARENT_APPROVAL", "APPROVAL_REQUIRED", "DECLINED"].includes(p.status);
  const steps: Step[] = [
    { title: "Product found", detail: `${p.title} · ${p.merchant}`, state: "done" },
    sellerBad
      ? { title: "Seller not verified", detail: "LinkPass won't send money to this account", state: "failed" }
      : { title: "Seller verified", detail: `Pays ${p.resolved_account_name}`, state: "done" },
  ];
  if (sellerBad) return steps;

  if (!needsParent) {
    steps.push({ title: "Rules checked", detail: "Inside every rule your parent set", state: "done" });
  } else {
    steps.push({ title: "Rules checked", detail: `${rulesFailed.length} rule${rulesFailed.length === 1 ? "" : "s"} need${rulesFailed.length === 1 ? "s" : ""} a parent`, state: "waiting" });
    const approval: Step = { title: viewer === "child" ? "Parent's OK" : "Your approval", state: "todo" };
    if (p.status === "NEEDS_PARENT_APPROVAL") approval.detail = viewer === "child" ? "Not asked yet" : "Not requested";
    else if (p.status === "APPROVAL_REQUIRED") Object.assign(approval, { state: "current", detail: viewer === "child" ? "Waiting for your parent" : "Waiting for you" });
    else if (p.status === "DECLINED") Object.assign(approval, { state: "failed", detail: "Declined" });
    else Object.assign(approval, { state: "done", detail: p.approval_method === "ALLOWANCE" ? "Approved from allowance" : "Approved, paid at checkout" });
    steps.push(approval);
  }

  const pay: Step = { title: "Payment", state: "todo", detail: "Confirmed only by the bank" };
  if (PAY_OPEN.includes(p.status)) Object.assign(pay, { state: "current", detail: p.status === "PAYMENT_READY" ? "Waiting for checkout" : "Bank is processing, money held" });
  if (p.status === "PAID") Object.assign(pay, { title: "Paid", state: "done", detail: `Bank confirmed · ${p.bank_reference}` });
  if (p.status === "FAILED") Object.assign(pay, { title: "Payment failed", state: "failed", detail: "Nothing was taken" });
  if (p.status === "REVERSED") Object.assign(pay, { title: "Payment reversed", state: "failed", detail: "The bank returned the money" });
  if (p.status !== "DECLINED") steps.push(pay);
  return steps;
}
