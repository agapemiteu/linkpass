import { BankClient, BankError, TransferResult } from "./types";

// MOCK BANK for local development only. Mirrors the Forge contract; never used when BANK_PROVIDER=forge.
const balances = new Map<string, number>([["0123456789", 150_000_000]]);
const transfers = new Map<string, TransferResult & { pendingUntil?: number; final?: "successful" | "failed" }>();
const payments = new Map<string, { amountKobo: number; createdAt: number }>();
const names: Record<string, string> = {
  "0123456790": "BABATUNDE OLUMIDE ADEYEMI",
  "0123456793": "MAMA NKECHI PROVISIONS LTD",
};

export const mockClient: BankClient = {
  label: "mock",

  async intraNameEnquiry(accountNumber) {
    const accountName = names[accountNumber];
    if (!accountName) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found (mock)", 404);
    return { nameEnquiryRef: `NE-MOCK-${crypto.randomUUID().slice(0, 8)}`, accountName, accountNumber };
  },

  async intraTransfer(req, _key, testOutcome) {
    const existing = transfers.get(req.reference);
    if (existing) return existing;
    if (testOutcome === "timeout") {
      transfers.set(req.reference, { reference: req.reference, status: "pending", amountKobo: req.amountKobo, totalDebitKobo: req.amountKobo, pendingUntil: Date.now() + 15_000, final: "successful" });
      throw new BankError("TIMEOUT", "Downstream bank did not answer (mock)", 504);
    }
    const bal = balances.get(req.sourceAccount) ?? 0;
    if (bal < req.amountKobo || testOutcome === "failed") throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds (mock)", 402);
    balances.set(req.sourceAccount, bal - req.amountKobo);
    const pending = testOutcome === "pending";
    const t = {
      reference: req.reference,
      status: pending ? ("pending" as const) : ("successful" as const),
      amountKobo: req.amountKobo,
      totalDebitKobo: req.amountKobo,
      pendingUntil: pending ? Date.now() + 15_000 : undefined,
      final: "successful" as const,
    };
    transfers.set(req.reference, t);
    return t;
  },

  async getTransfer(reference) {
    const t = transfers.get(reference);
    if (!t) throw new BankError("NOT_FOUND", "Transfer not found (mock)", 404);
    if (t.pendingUntil && Date.now() > t.pendingUntil) {
      t.status = t.final ?? "successful";
      t.pendingUntil = undefined;
    }
    return t;
  },

  async createCheckout(req) {
    payments.set(req.reference, { amountKobo: req.amountKobo, createdAt: Date.now() });
    const url = `${req.callbackUrl}${req.callbackUrl.includes("?") ? "&" : "?"}reference=${req.reference}&status=successful`;
    return { reference: req.reference, paymentUrl: url, status: "pending" };
  },

  async verifyPayment(reference) {
    const p = payments.get(reference);
    if (!p) throw new BankError("NOT_FOUND", "Payment not found (mock)", 404);
    return { reference, status: "successful", amountKobo: p.amountKobo, amountPaidKobo: p.amountKobo };
  },

  async getBalance(accountNumber) {
    return { accountNumber, availableKobo: balances.get(accountNumber) ?? 0, requestId: "mock" };
  },

  async registerWebhook() {
    return { secret: "mock-secret" };
  },

  async adminReset() {
    transfers.clear();
    payments.clear();
    balances.set("0123456789", 150_000_000);
  },
};
