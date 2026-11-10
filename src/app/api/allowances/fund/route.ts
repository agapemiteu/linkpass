import { body, handle } from "@/lib/api";
import { childOf, requireRole } from "@/lib/auth";
import { bank, CONTROLLED_SOURCE_ACCOUNT } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { fundAllowance } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handle(async () => {
    const guardian = await requireRole("GUARDIAN");
    const child = childOf(guardian.familyId)!;
    const b = await body<{ amount_ngn: number }>(req);
    return fundAllowance(getDb(), bank(), child.id, guardian.id, Math.round(Number(b.amount_ngn) * 100), CONTROLLED_SOURCE_ACCOUNT);
  });
}
