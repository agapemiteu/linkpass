import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { journey } from "@/lib/journey";
import type { ReasonCode } from "@/lib/policies/evaluator";
import { ngn, purchaseFor, STATUS_LABEL, TONE } from "@/lib/views";
import { ActionButton } from "@/components/action-button";
import { StatusPoller } from "@/components/status-poller";
import { Icon, Reasons, Steps, TopBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function headline(status: string, price: string, codes: ReasonCode[]) {
  switch (status) {
    case "AUTO_APPROVED":
      return "You're good to go. It's within your allowance and from a seller your parent approved.";
    case "NEEDS_PARENT_APPROVAL":
      return codes.includes("ABOVE_SINGLE_LIMIT")
        ? `This costs ${price}, above your automatic limit. Ask your parent to approve it.`
        : "This one needs your parent's OK first.";
    case "BLOCKED":
      return "LinkPass won't pay this seller. They aren't verified, so there's no way to be sure where the money goes.";
    case "APPROVAL_REQUIRED":
      return "Sent to your parent. This page updates when they decide.";
    case "DECLINED":
      return "Your parent said no to this one.";
    case "APPROVED":
    case "PAYMENT_READY":
      return "Your parent approved it and is completing the payment.";
    case "RESERVED":
    case "PAYMENT_PENDING":
      return "The bank is processing the payment. Your money is held until it confirms.";
    case "PAID":
      return "Done. The bank confirmed the payment and the seller has been paid.";
    case "FAILED":
      return "The payment didn't go through. Nothing was taken from your allowance.";
    case "REVERSED":
      return "The bank reversed this payment and the money is back in your allowance.";
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

      <Link href="/child" className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <Icon icon={ArrowLeft01Icon} size={18} /> Shopping
      </Link>

      <Card className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt="" className="size-20 rounded-2xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{p.title}</p>
          <p className="text-sm text-muted">{p.merchant}</p>
          <p className="tabular mt-1 text-[22px] font-semibold">{ngn(p.price_kobo)}</p>
        </div>
      </Card>

      <Card className={`rise mt-4 ${tone === "go" ? "bg-go-soft" : tone === "stop" ? "bg-stop-soft" : tone === "ask" ? "bg-ask-soft" : ""}`}>
        <Badge tone={tone} className="bg-white/70">{STATUS_LABEL[p.status]}</Badge>
        <p className="mt-3 text-[19px] leading-snug font-semibold tracking-tight">{headline(p.status, ngn(p.price_kobo), codes)}</p>
      </Card>

      <Card className="mt-4">
        <CardLabel className="mb-4">Progress</CardLabel>
        <Steps steps={journey(p, "child")} />
      </Card>

      <Card className="mt-4">
        <CardLabel className="mb-4">Checked against your parent&apos;s rules</CardLabel>
        <Reasons codes={codes} />
      </Card>

      <div className="mt-6 space-y-3">
        {p.status === "AUTO_APPROVED" && <ActionButton url={`/api/purchases/${p.id}/execute`} variant="go">Pay {ngn(p.price_kobo)}</ActionButton>}
        {p.status === "NEEDS_PARENT_APPROVAL" && <ActionButton url={`/api/purchases/${p.id}/request-approval`}>Ask parent</ActionButton>}
      </div>
    </main>
  );
}
