import { handle } from "@/lib/api";
import { AuthError, currentUser } from "@/lib/auth";
import { bank } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { getAttempt, getPurchase, PurchaseError, refresh } from "@/lib/purchases";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new AuthError(401);
    const { id } = await params;
    const db = (await getDb());
    const p = await getPurchase(db, id);
    const owner = p && (await db.get<{ family_id: string }>("SELECT family_id FROM users WHERE id = ?", p.child_id));
    if (!p || owner?.family_id !== user.familyId) throw new PurchaseError("NOT_FOUND", "Purchase not found", 404);
    await refresh(db, bank(), id);
    const fresh = (await getPurchase(db, id))!;
    const a = await getAttempt(db, id);
    return {
      status: fresh.status,
      decision: fresh.decision,
      reason_codes: JSON.parse(fresh.reason_codes),
      payment: a ? { mode: a.mode, reference: a.bank_reference, bank_status: a.bank_status } : null,
    };
  });
}
