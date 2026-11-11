import { body, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decide, PurchaseError } from "@/lib/purchases";

export const runtime = "nodejs";

// The guardian comes from the session, never from the request body.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guardian = await requireRole("GUARDIAN");
    const b = await body<{ decision: string; method?: string }>(req);
    if (b.decision !== "APPROVE" && b.decision !== "DECLINE") throw new PurchaseError("INVALID", "decision must be APPROVE or DECLINE");
    const method = b.method === "ALLOWANCE" ? "ALLOWANCE" : "CHECKOUT";
    await decide((await getDb()), (await params).id, guardian, b.decision, method);
  });
}
