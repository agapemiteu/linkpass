import { demoMode, handle } from "@/lib/api";
import { AuthError, currentUser } from "@/lib/auth";
import { bank, CONTROLLED_SOURCE_ACCOUNT } from "@/lib/bank";
import type { TestOutcome } from "@/lib/bank/types";
import { getDb } from "@/lib/db";
import { executeTransfer } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new AuthError(401);
    const db = (await getDb());
    // Demo Mode only: a one-shot forced bank outcome set from the demo panel (x-test-outcome).
    let outcome: TestOutcome | undefined;
    if (demoMode()) {
      const row = await db.get<{ value: TestOutcome }>("DELETE FROM settings WHERE key = 'next_transfer_outcome' RETURNING value");
      outcome = row?.value;
    }
    return await executeTransfer(db, bank(), (await params).id, user, CONTROLLED_SOURCE_ACCOUNT, outcome);
  });
}
