import Link from "next/link";
import { redirect } from "next/navigation";
import { childOf, currentUser } from "@/lib/auth";
import { activity, familySummary, ngn, purchasesFor, STATUS_LABEL, TONE } from "@/lib/views";
import { Card, Pill, Row, TopBar } from "@/components/ui";
import { FundForm } from "@/components/fund-form";

export const dynamic = "force-dynamic";

const EVENT_TEXT: Record<string, string> = {
  PURCHASE_EVALUATED: "Checked a purchase",
  APPROVAL_REQUESTED: "Asked you to approve",
  PARENT_APPROVED: "You approved",
  PARENT_DECLINED: "You declined",
  FUNDS_RESERVED: "Funds reserved",
  PAYMENT_CONFIRMED: "Bank confirmed payment",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_REVERSED: "Payment reversed",
  TRANSFER_OUTCOME_UNKNOWN: "Bank outcome pending",
  CHECKOUT_CREATED: "Checkout opened",
  ALLOWANCE_FUNDED: "Allowance funded",
  POLICY_ACTIVATED: "Permissions updated",
  POLICY_REVOKED: "Permissions revoked",
};

export default async function ParentHome() {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN") redirect("/");
  const child = childOf(user.familyId)!;
  const { balances, policy, merchantNames } = familySummary(child.id);
  const purchases = purchasesFor(child.id, 20);
  const waiting = purchases.filter((p) => p.status === "APPROVAL_REQUIRED" || p.status === "APPROVED" || p.status === "PAYMENT_READY");
  const events = activity(child.id, 15);

  return (
    <main>
      <TopBar name={user.displayName} role="parent" />

      {waiting.map((p) => (
        <Link key={p.id} href={`/parent/requests/${p.id}`} className="mb-3 flex items-center gap-3 rounded-2xl border border-ask/40 bg-ask-soft p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image_url} alt="" className="size-12 rounded-lg object-cover" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{child.display_name} wants {p.title}</p>
            <p className="tabular text-sm text-ask">{ngn(p.price_kobo)} · {STATUS_LABEL[p.status]}</p>
          </div>
          <span aria-hidden>→</span>
        </Link>
      ))}

      <Card>
        <p className="text-sm text-muted">{child.display_name}&apos;s allowance</p>
        <p className="tabular font-display text-3xl font-medium">{ngn(balances.availableKobo)}</p>
        <div className="mt-3 border-t border-line pt-2">
          <Row label="Funded">{ngn(balances.fundedKobo)}</Row>
          <Row label="Held for pending payments">{ngn(balances.reservedKobo)}</Row>
          <Row label="Spent">{ngn(balances.spentKobo)}</Row>
        </div>
        <FundForm />
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Shopping permissions{policy ? ` · v${policy.version}` : ""}</h2>
          <Link href="/parent/permissions" className="text-sm font-medium underline underline-offset-4">Edit</Link>
        </div>
        {policy ? (
          <div className="mt-2">
            <Row label="Automatic purchase limit">{ngn(policy.maximumSinglePurchaseKobo)}</Row>
            <Row label="Daily limit">{ngn(policy.dailyLimitKobo)}</Row>
            <Row label="Approved sellers">{merchantNames.map((m) => m.display_name).join(", ") || "None"}</Row>
            <Row label="Categories">{policy.categories.join(", ") || "None"}</Row>
            <Row label="Expires">{new Date(policy.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Row>
            <Row label="Everything else">Ask me</Row>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ask">No active permissions. Every purchase comes to you.</p>
        )}
      </Card>

      {purchases.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-muted">Purchases</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/parent/requests/${p.id}`} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="min-w-0 truncate">{p.title} <span className="text-muted">· {p.merchant}</span></span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{ngn(p.price_kobo)}</span>
                    <Pill tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-muted">Activity</h2>
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-4">
                <span>{EVENT_TEXT[e.event] ?? e.event}</span>
                <time className="tabular text-muted">{new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Link href="/demo" className="mt-10 block text-center text-xs text-muted underline underline-offset-4">Demo tools</Link>
    </main>
  );
}
