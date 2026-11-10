// Shapes follow the Forge Sandbox API Specification v2. Amounts here are kobo; adapters convert to naira.

export type TransferStatus = "pending" | "successful" | "failed" | "reversed";
export type PaymentStatus = "pending" | "successful" | "failed" | "partial" | "overpaid" | "expired";

export class BankError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
    public requestId?: string,
  ) {
    super(message);
  }
  // TIMEOUT, 5xx and network failures mean the outcome is unknown: requery, never resend.
  get outcomeUnknown() {
    return this.code === "TIMEOUT" || this.code === "NETWORK_ERROR" || this.httpStatus >= 500;
  }
}

export type NameEnquiry = { nameEnquiryRef: string; accountName: string; accountNumber: string };

export type TransferResult = {
  reference: string;
  status: TransferStatus;
  amountKobo: number;
  totalDebitKobo: number;
};

export type CheckoutResult = { reference: string; paymentUrl: string; status: PaymentStatus };

export type VerifyResult = { reference: string; status: PaymentStatus; amountKobo: number; amountPaidKobo: number };

export type BalanceResult = { accountNumber: string; availableKobo: number; requestId?: string };

export type TestOutcome = "successful" | "failed" | "pending" | "timeout" | "reversed";

export interface BankClient {
  readonly label: "forge" | "mock";
  intraNameEnquiry(accountNumber: string): Promise<NameEnquiry>;
  intraTransfer(
    req: { sourceAccount: string; destinationAccount: string; nameEnquiryRef: string; amountKobo: number; narration: string; reference: string },
    idempotencyKey: string,
    testOutcome?: TestOutcome,
  ): Promise<TransferResult>;
  getTransfer(reference: string): Promise<TransferResult>;
  createCheckout(
    req: { merchantId: string; amountKobo: number; description: string; reference: string; callbackUrl: string; customer: { name: string; email: string } },
    idempotencyKey: string,
  ): Promise<CheckoutResult>;
  verifyPayment(reference: string): Promise<VerifyResult>;
  getBalance(accountNumber: string): Promise<BalanceResult>;
  registerWebhook(url: string): Promise<{ secret: string }>;
  adminReset(): Promise<void>;
}

export const toNaira = (kobo: number) => Number((kobo / 100).toFixed(2));
export const toKobo = (naira: number) => Math.round(naira * 100);
