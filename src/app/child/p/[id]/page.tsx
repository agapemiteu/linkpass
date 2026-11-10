import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import type { ReasonCode } from "@/lib/policies/evaluator";
import { ngn, purchaseFor, STATUS_LABEL, TONE } from "@/lib/views";
import { ActionButton } from "@/components/action-button";
import { StatusPoller } from "@/components/status-poller";
import { Card, Pill, Reasons, Row, TopBar } from "@/components/ui";

export const dynamic = "force-dynamic";

function headline(status: string, price: string, codes: ReasonCode[]) {
  switch (status) {
    case "AUTO_APPROVED":
      return "You're good to go. This item is within your allowance and comes from a seller your parent approved.";
    case "NEEDS_PARENT_APPROVAL":
      return codes.includes("ABOVE_SINGLE_LIMIT")
        ? `This item costs ${price}, which is above your automatic limit. Ask your parent to approve it.`
        : "This one needs your parent's OK first.";
    case "BLOCKED":
      return "LinkPass won't pay this seller. They aren't verified, so there's no way to be sure where the money goes.";
    case "APPROVAL_REQUIRED":
      return "Sent to your parent. You'll see the result here.";
    case "DECLINED":
      return "Your parent said no to this one.";
    case "APPROVED":
    case "PAYMENT_READY":
      return "Your parent approved this. They're completing the payment.";
    case "RESERVED":
    case "PAYMENT_PENDING":
      return "The bank is processing the payment. Your money is held until it confirms.";
    case "PAID":
      return "Payment confirmed by the bank. The seller has been paid.";
    case "FAILED":
      return "The payment didn't go through. Nothing was taken from your allowance.";
    case "REVERSED":
      return "The bank reversed this payment and the money came back.";
    default:
      return "";
  }
}

export default async function ChildPurchase({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (user?.role !== "CHILD") redirect("/");
  const p = purchaseFor((await params).id, user.familyId);
  if (!p) notFound();
  const codes = JSON.parse(p.reason_codes) as ReasonCode[];
  const open = ["RESERVED", "PAYMENT_PENDING", "APPROVAL_REQUIRED", "APPROVED", "PAYMENT_READY"].includes(p.status);
  const tone = TONE[p.status];

  return (
    <main>
      <TopBar name={user.displayName} role="child" />
      <StatusPoller purchaseId={p.id} active={open} />

      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt="" className="size-20 rounded-xl object-cover" />
        <div>
          <p className="font-semibold">{p.title}</p>
          <p className="text-sm text-muted">{p.merchant}</p>
          <p className="tabular font-display text-2xl font-medium">{ngn(p.price_kobo)}</p>
        </div>
      </div>

      <Card className={`mt-6 ${tone === "go" ? "border-go/30" : tone === "stop" ? "border-stop/30" : tone === "ask" ? "border-ask/30" : ""}`}>
        <Pill tone={tone}>{STATUS_LABEL[p.status]}</Pill>
        <p className="mt-3 text-lg leading-snug">{headline(p.status, ngn(p.price_kobo), codes)}</p>
        <div className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Checked against your parent&apos;s rules</p>
          <Reasons codes={codes} />
        </div>
      </Card>

      {p.bank_reference && (
        <Card className="mt-4">
          <Row label="Bank reference"><span className="font-mono text-xs">{p.bank_reference}</span></Row>
          <Row label="Paid to">{p.resolved_account_name}</Row>
          <Row label="Bank status">{p.bank_status ?? "—"}</Row>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {p.status === "AUTO_APPROVED" && (
          <ActionButton url={`/api/purchases/${p.id}/execute`}>Pay {ngn(p.price_kobo)}</ActionButton>
        )}
        {p.status === "NEEDS_PARENT_APPROVAL" && <ActionButton url={`/api/purchases/${p.id}/request-approval`}>Ask parent</ActionButton>}
        <Link href="/child" className="block h-12 rounded-xl border border-line bg-card text-center text-sm leading-[3rem] font-semibold">
          Back to shopping
        </Link>
      </div>
    </main>
  );
}
