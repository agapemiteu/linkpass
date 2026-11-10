import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ActionButton } from "@/components/action-button";
import { Card, Row, TopBar } from "@/components/ui";

export const dynamic = "force-dynamic";

const OUTCOMES = ["pending", "timeout", "failed", "reversed"];

export default async function Demo() {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN" || process.env.DEMO_MODE === "false") redirect("/");
  const db = getDb();
  const setting = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value;
  const next = setting("next_transfer_outcome");

  return (
    <main>
      <TopBar name={user.displayName} role="parent" />
      <h1 className="font-display text-3xl font-medium tracking-tight">Demo tools</h1>
      <p className="mt-2 text-sm text-muted">For judges and testing. Uses only the sandbox&apos;s documented test controls.</p>

      <Card className="mt-6">
        <Row label="Bank provider">{process.env.BANK_PROVIDER === "forge" ? "Forge sandbox (real)" : "MOCK (local only)"}</Row>
        <Row label="Webhook registered">{setting("webhook_secret") ? "Yes" : "No"}</Row>
        <Row label="Next transfer outcome">{next ?? "Normal"}</Row>
      </Card>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-medium">Force the next allowance transfer (x-test-outcome)</p>
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => (
            <ActionButton key={o} url="/api/demo" payload={{ action: "outcome", outcome: o }} variant="ghost">{o}</ActionButton>
          ))}
        </div>
        <ActionButton url="/api/demo" payload={{ action: "outcome" }} variant="ghost">Back to normal</ActionButton>
      </div>

      <div className="mt-8 space-y-3">
        <ActionButton url="/api/demo" payload={{ action: "register-webhook" }} variant="ghost">Register bank webhook</ActionButton>
        <ActionButton url="/api/demo" payload={{ action: "reset" }} variant="danger" then="/" confirm="Reset the bank sandbox and all LinkPass data?">
          Reset everything
        </ActionButton>
      </div>
    </main>
  );
}
