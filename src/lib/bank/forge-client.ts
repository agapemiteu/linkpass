import "server-only";
import { BankClient, BankError, PaymentStatus, TestOutcome, TransferResult, TransferStatus, toKobo, toNaira } from "./types";

const BASE = process.env.BANK_API_BASE_URL ?? "http://bank-api.ingress-apisix.svc.cluster.local/v1";

type Envelope<T> = { status: "success" | "error"; data?: T; error?: { code: string; message: string }; request_id?: string };

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const key = process.env.GATEWAY_KEY;
  if (!key) throw new BankError("CONFIG", "GATEWAY_KEY is not set", 500);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "x-api-key": key, "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new BankError("NETWORK_ERROR", e instanceof Error ? e.message : "network error", 0);
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.status !== "success") {
    const code = json?.error?.code ?? (res.status === 504 ? "TIMEOUT" : `HTTP_${res.status}`);
    throw new BankError(code, json?.error?.message ?? res.statusText, res.status, json?.request_id);
  }
  return { data: json.data as T, requestId: json.request_id };
}

type RawTransfer = { reference: string; status: TransferStatus; amount: number; total_debit?: number; fee?: number; vat?: number };
const mapTransfer = (t: RawTransfer): TransferResult => ({
  reference: t.reference,
  status: t.status,
  amountKobo: toKobo(t.amount),
  totalDebitKobo: toKobo(t.total_debit ?? t.amount + (t.fee ?? 0) + (t.vat ?? 0)),
});

export const forgeClient: BankClient = {
  label: "forge",

  async intraNameEnquiry(accountNumber) {
    const { data } = await call<{ name_enquiry_ref: string; account_name: string; account_number: string }>(
      "POST", "/transfers/intra/name-enquiry", { account_number: accountNumber },
    );
    return { nameEnquiryRef: data.name_enquiry_ref, accountName: data.account_name, accountNumber: data.account_number };
  },

  async intraTransfer(req, idempotencyKey, testOutcome?: TestOutcome) {
    const headers: Record<string, string> = { "Idempotency-Key": idempotencyKey };
    if (testOutcome) headers["x-test-outcome"] = testOutcome;
    const { data } = await call<RawTransfer>("POST", "/transfers/intra", {
      source_account: req.sourceAccount,
      destination_account: req.destinationAccount,
      name_enquiry_ref: req.nameEnquiryRef,
      amount: toNaira(req.amountKobo),
      currency: "NGN",
      narration: req.narration,
      reference: req.reference,
    }, headers);
    return mapTransfer(data);
  },

  async getTransfer(reference) {
    const { data } = await call<RawTransfer>("GET", `/transfers/${encodeURIComponent(reference)}`);
    return mapTransfer(data);
  },

  async createCheckout(req, idempotencyKey) {
    const { data } = await call<{ reference: string; payment_url: string; status: PaymentStatus }>(
      "POST", "/payments/checkout", {
        merchant_id: req.merchantId,
        amount: toNaira(req.amountKobo),
        currency: "NGN",
        customer: req.customer,
        channels: ["card", "bank_transfer", "ussd", "qr"],
        description: req.description,
        reference: req.reference,
        callback_url: req.callbackUrl,
      }, { "Idempotency-Key": idempotencyKey },
    );
    return { reference: data.reference, paymentUrl: data.payment_url, status: data.status };
  },

  async verifyPayment(reference) {
    const { data } = await call<{ reference: string; status: PaymentStatus; amount: number; amount_paid?: number }>(
      "GET", `/payments/${encodeURIComponent(reference)}/verify`,
    );
    return { reference: data.reference, status: data.status, amountKobo: toKobo(data.amount), amountPaidKobo: toKobo(data.amount_paid ?? 0) };
  },

  async getBalance(accountNumber) {
    const { data, requestId } = await call<{ account_number: string; available_balance: number }>(
      "GET", `/accounts/${encodeURIComponent(accountNumber)}/balance`,
    );
    return { accountNumber: data.account_number, availableKobo: toKobo(data.available_balance), requestId };
  },

  async registerWebhook(url) {
    const { data } = await call<{ webhook_secret: string }>("POST", "/webhooks", { url, events: ["*"] });
    return { secret: data.webhook_secret };
  },

  async adminReset() {
    await call("POST", "/admin/reset", {}, { "Idempotency-Key": crypto.randomUUID() });
  },
};
