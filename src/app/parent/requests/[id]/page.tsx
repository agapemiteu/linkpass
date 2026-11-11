import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft01Icon, Alert02Icon, BankIcon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { journey } from "@/lib/journey";
import { REASON_TEXT, isPassing, type ReasonCode } from "@/lib/policies/evaluator";
import { ngn, purchaseFor, STATUS_LABEL, TONE } from "@/lib/views";
import { ActionButton } from "@/components/action-button";
import { StatusPoller } from "@/components/status-poller";
import { Icon, Row, Steps, TopBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

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

      <Link href="/parent" className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <Icon icon={ArrowLeft01Icon} size={18} /> Home
      </Link>

      <Card className="overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt={p.title} className="aspect-[16/10] w-full object-cover" />
        <div className="p-5">
          <Badge tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
          <p className="mt-3 text-[15px] text-muted">{p.child_name} wants</p>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[21px] font-semibold tracking-tight">{p.title}</p>
            <p className="tabular text-[22px] font-semibold">{ngn(p.price_kobo)}</p>
          </div>
          <div className="mt-3 divide-y divide-line border-t border-line">
            <Row label="Seller">{p.merchant}</Row>
            <Row label="Verified seller">{p.merchant_verified ? "Yes" : "No"}</Row>
            <Row label="Pays to">{p.resolved_account_name}</Row>
            <Row label="Category">{p.category}</Row>
          </div>
        </div>
      </Card>

      {failing.length > 0 && p.status === "APPROVAL_REQUIRED" && (
        <Card className="mt-4 bg-ask-soft">
          <p className="flex items-center gap-2 font-semibold text-ask"><Icon icon={Alert02Icon} /> Why this needs you</p>
          <ul className="mt-2 space-y-1 pl-8 text-[15px]">
            {failing.map((c) => <li key={c}>{REASON_TEXT[c]}</li>)}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardLabel className="mb-4">Progress</CardLabel>
        <Steps steps={journey(p, "parent")} />
        {p.bank_reference && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-paper p-3 text-sm">
            <Icon icon={BankIcon} className="text-muted" />
            <div className="min-w-0">
              <p className="font-mono text-xs">{p.bank_reference}</p>
              <p className="text-muted">
                {p.mode === "CHECKOUT" ? "Bank checkout" : "Allowance transfer"} · bank says {p.bank_status ?? "—"}
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 space-y-3">
        {p.status === "APPROVAL_REQUIRED" && (
          <>
            <ActionButton url={`/api/approvals/${p.id}/decision`} payload={{ decision: "APPROVE", method: "CHECKOUT" }}>
              Approve and pay at checkout
            </ActionButton>
            <ActionButton url={`/api/approvals/${p.id}/decision`} payload={{ decision: "APPROVE", method: "ALLOWANCE" }} variant="secondary">
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
          <ActionButton url={`/api/purchases/${p.id}/execute`} variant="go">Pay {ngn(p.price_kobo)} from allowance</ActionButton>
        )}
        {p.status === "PAYMENT_READY" && p.payment_url && (
          <a href={p.payment_url} className={buttonVariants()}>Continue to checkout</a>
        )}
      </div>
    </main>
  );
}
