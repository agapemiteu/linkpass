import { body, handle } from "@/lib/api";
import { childOf, requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PurchaseError, revokePolicy, savePolicy } from "@/lib/purchases";

export const runtime = "nodejs";

const naira = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) throw new PurchaseError("INVALID_AMOUNT", "Amounts must be between ₦1 and ₦5,000,000");
  return Math.round(n * 100);
};

export async function POST(req: Request) {
  return handle(async () => {
    const guardian = await requireRole("GUARDIAN");
    const child = childOf(guardian.familyId)!;
    const b = await body<{ action?: string; max_single_ngn: number; daily_limit_ngn: number; merchant_ids: string[]; categories: string[]; days: number }>(req);
    if (b.action === "revoke") return revokePolicy(getDb(), guardian, child.id);
    const days = Math.min(Math.max(Math.round(Number(b.days) || 30), 1), 365);
    const version = savePolicy(getDb(), guardian, child.id, {
      maximumSinglePurchaseKobo: naira(b.max_single_ngn),
      dailyLimitKobo: naira(b.daily_limit_ngn),
      merchantIds: (b.merchant_ids ?? []).map(String),
      categories: (b.categories ?? []).map((c) => String(c).toLowerCase()),
      expiresAt: new Date(Date.now() + days * 86400_000).toISOString(),
    });
    return { version };
  });
}
