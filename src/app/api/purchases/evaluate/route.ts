import { body, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createPurchase } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handle(async () => {
    const child = await requireRole("CHILD");
    const b = await body<{ offer_id: string; source_url?: string; extracted?: unknown }>(req);
    const r = await createPurchase((await getDb()), child.id, String(b.offer_id), { url: b.source_url, extracted: b.extracted });
    return { purchase_request_id: r.id, decision: r.decision, reason_codes: r.reasons, policy_version: r.policyVersion };
  });
}
