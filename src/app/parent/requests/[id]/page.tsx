import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { REASON_TEXT, isPassing, type ReasonCode } from "@/lib/policies/evaluator";
import { ngn, purchaseFor, STATUS_LABEL, TONE } from "@/lib/views";
import { ActionButton } from "@/components/action-button";
import { StatusPoller } from "@/components/status-poller";
import { Card, Pill, Row, TopBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ParentRequest({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN") redirect("/");
  const p = purchaseFor((await params).id, user.familyId);
  if (!p) notFound();
  const failing = (JSON.parse(p.reason_codes) as ReasonCode[]).filter((c) => !isPassing(c));
  const open = ["RESERVED", "PAYMENT_PENDING", "PAYMENT_READY"].includes(p.status);

  return (
    <main>
      <TopBar name={user.displayName} role="parent" />
      <StatusPoller purchaseId={p.id} active={open} />

      <Card className="p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt={p.title} className="aspect-[4/3] w-full rounded-t-2xl object-cover" />
        <div className="p-5">
          <Pill tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill>
          <p className="mt-3 text-sm text-muted">{p.child_name} wants</p>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-semibold">{p.title}</p>
            <p className="tabular font-display text-2xl font-medium">{ngn(p.price_kobo)}</p>
          </div>
          <div className="mt-3 border-t border-line pt-2">
            <Row label="Seller">{p.merchant}</Row>
            <Row label="Seller verified">{p.merchant_verified ? "Yes" : "No"}</Row>
            <Row label="Bank account holder">{p.resolved_account_name}</Row>
            <Row label="Category">{p.category}</Row>
          </div>
          {failing.length > 0 && (
            <div className="mt-3 rounded-xl bg-ask-soft p-4 text-sm">
              <p className="font-semibold text-ask">Why this needs you</p>
              <ul className="mt-1 list-disc pl-5">
                {failing.map((c) => <li key={c}>{REASON_TEXT[c]}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {p.bank_reference && (
        <Card className="mt-4">
          <Row label="Payment route">{p.mode === "CHECKOUT" ? "You paid at checkout" : "Allowance transfer"}</Row>
          <Row label="Bank reference"><span className="font-mono text-xs">{p.bank_reference}</span></Row>
          <Row label="Bank status">{p.bank_status ?? "—"}</Row>
          {p.last_error && <Row label="Bank message">{p.last_error}</Row>}
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {p.status === "APPROVAL_REQUIRED" && (
          <>
            <ActionButton url={`/api/approvals/${p.id}/decision`} payload={{ decision: "APPROVE", method: "CHECKOUT" }}>
              Approve and pay at checkout
            </ActionButton>
            <ActionButton url={`/api/approvals/${p.id}/decision`} payload={{ decision: "APPROVE", method: "ALLOWANCE" }} variant="ghost">
              Approve from {p.child_name}&apos;s allowance
            </ActionButton>
            <ActionButton url={`/api/approvals/${p.id}/decision`} payload={{ decision: "DECLINE" }} variant="danger">
              Decline
            </ActionButton>
          </>
        )}
        {p.status === "APPROVED" && p.approval_method === "CHECKOUT" && (
          <ActionButton url={`/api/purchases/${p.id}/checkout`} then="open-payment">Pay {ngn(p.price_kobo)} with Xtradot Bank</ActionButton>
        )}
        {p.status === "APPROVED" && p.approval_method === "ALLOWANCE" && (
          <ActionButton url={`/api/purchases/${p.id}/execute`}>Pay {ngn(p.price_kobo)} from allowance</ActionButton>
        )}
        {p.status === "PAYMENT_READY" && p.payment_url && (
          <a href={p.payment_url} className="block h-12 rounded-xl bg-ink text-center text-sm leading-[3rem] font-semibold text-white">
            Continue to checkout
          </a>
        )}
        <Link href="/parent" className="block h-12 rounded-xl border border-line bg-card text-center text-sm leading-[3rem] font-semibold">
          Back
        </Link>
      </div>
    </main>
  );
}
