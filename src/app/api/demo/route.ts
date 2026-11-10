import { body, demoMode, handle } from "@/lib/api";
import { requireRole, setSession, clearSession } from "@/lib/auth";
import { bank } from "@/lib/bank";
import { getDb, resetDb } from "@/lib/db";
import { PurchaseError } from "@/lib/purchases";

export const runtime = "nodejs";

const OUTCOMES = ["successful", "failed", "pending", "timeout", "reversed"];

// Demo Mode tools: pick a seeded identity, reset state, register the webhook, force the next bank outcome.
export async function POST(req: Request) {
  return handle(async () => {
    if (!demoMode()) throw new PurchaseError("DISABLED", "Demo Mode is off", 404);
    const b = await body<{ action: string; user_id?: string; outcome?: string }>(req);
    const db = getDb();
    switch (b.action) {
      case "login": {
        if (b.user_id !== "guardian_001" && b.user_id !== "child_001") throw new PurchaseError("INVALID", "Unknown demo user");
        await setSession(b.user_id);
        return { ok: true };
      }
      case "logout":
        await clearSession();
        return { ok: true };
      case "reset": {
        await requireRole("GUARDIAN");
        await bank().adminReset();
        resetDb();
        await clearSession();
        return { ok: true };
      }
      case "register-webhook": {
        await requireRole("GUARDIAN");
        const team = process.env.TEAM_ID ?? "team06";
        const { secret } = await bank().registerWebhook(`http://app.${team}.svc.cluster.local/api/webhooks/forge`);
        db.prepare("INSERT OR REPLACE INTO settings VALUES ('webhook_secret', ?)").run(secret);
        return { ok: true };
      }
      case "outcome": {
        await requireRole("GUARDIAN");
        if (!b.outcome) db.prepare("DELETE FROM settings WHERE key = 'next_transfer_outcome'").run();
        else if (OUTCOMES.includes(b.outcome)) db.prepare("INSERT OR REPLACE INTO settings VALUES ('next_transfer_outcome', ?)").run(b.outcome);
        return { ok: true };
      }
      default:
        throw new PurchaseError("INVALID", "Unknown action");
    }
  });
}
