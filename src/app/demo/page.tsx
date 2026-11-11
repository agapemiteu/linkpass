import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ActionButton } from "@/components/action-button";
import { Icon, Row, TopBar } from "@/components/ui";
import { Card, CardLabel } from "@/components/ui/card";

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
      <Link href="/parent" className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <Icon icon={ArrowLeft01Icon} size={18} /> Home
      </Link>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em]">Demo tools</h1>
      <p className="mt-1 text-[15px] text-muted">For judges and testing. Uses only the sandbox&apos;s documented test controls.</p>

      <Card className="mt-6 divide-y divide-line py-2">
        <Row label="Bank">{process.env.BANK_PROVIDER === "forge" ? "Forge sandbox" : "MOCK (local only)"}</Row>
        <Row label="Webhook">{setting("webhook_secret") ? "Registered" : "Not registered"}</Row>
        <Row label="Next transfer">{next ?? "Normal"}</Row>
      </Card>

      <CardLabel className="mt-8 mb-2 px-1">Force the next allowance transfer (x-test-outcome)</CardLabel>
      <div className="grid grid-cols-2 gap-2">
        {OUTCOMES.map((o) => (
          <ActionButton key={o} url="/api/demo" payload={{ action: "outcome", outcome: o }} variant="outline">
            <span className="capitalize">{o}</span>
          </ActionButton>
        ))}
      </div>
      <div className="mt-2">
        <ActionButton url="/api/demo" payload={{ action: "outcome" }} variant="secondary">Back to normal</ActionButton>
      </div>

      <div className="mt-8 space-y-3">
        <ActionButton url="/api/demo" payload={{ action: "register-webhook" }} variant="secondary">Register bank webhook</ActionButton>
        <ActionButton url="/api/demo" payload={{ action: "reset" }} variant="danger" then="/" confirm="Reset the bank sandbox and all LinkPass data?">
          Reset everything
        </ActionButton>
      </div>
    </main>
  );
}
