import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { journey } from "@/lib/journey";
import type { ReasonCode } from "@/lib/policies/evaluator";
import { ngn, purchaseFor, STATUS_LABEL, TONE } from "@/lib/views";
import { ActionButton } from "@/components/action-button";
import { StatusPoller } from "@/components/status-poller";
import { Icon, Reasons, TopBar } from "@/components/ui";
import { JourneyPath } from "@/components/journey-path";
import { Confetti } from "@/components/confetti";
import { FadeUp } from "@/components/motion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function headline(status: string, price: string, codes: ReasonCode[]) {
  switch (status) {
    case "AUTO_APPROVED":
      return "You're good to go! It fits your allowance and comes from a seller your parent trusts.";
    case "NEEDS_PARENT_APPROVAL":
      return codes.includes("ABOVE_SINGLE_LIMIT") ? `This one is ${price}, a bit above your limit. Ask your parent?` : "This one needs your parent's OK first.";
    case "BLOCKED":
      return "Hold on. This seller isn't verified, so LinkPass won't send them money.";
    case "APPROVAL_REQUIRED":
      return "Sent to your parent. We'll update this as soon as they decide.";
    case "DECLINED":
      return "Your parent said no to this one.";
    case "APPROVED":
    case "PAYMENT_READY":
      return "Your parent said yes and is paying now.";
    case "RESERVED":
    case "PAYMENT_PENDING":
      return "The bank is processing it. Your money is safely held.";
    case "PAID":
      return "It's yours! The bank confirmed the payment.";
    case "FAILED":
      return "That payment didn't go through. Nothing was taken.";
    case "REVERSED":
      return "The bank reversed this payment. Your money is back.";
    default:
      return "";
  }
}

// Background glow per outcome, so each moment has its own mood.
const GLOW = {
  go: "from-blue/30 via-lilac/25 to-mint/30",
  ask: "from-sun/40 via-coral/20 to-lilac/25",
  stop: "from-coral/35 via-stop/15 to-sun/20",
  neutral: "from-lilac/25 via-blue/15 to-mint/20",
};

export default async function ChildPurchase({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (user?.role !== "CHILD") redirect("/");
  const p = await purchaseFor((await params).id, user.familyId);
  if (!p) notFound();
  const codes = JSON.parse(p.reason_codes) as ReasonCode[];
  const open = ["RESERVED", "PAYMENT_PENDING", "APPROVAL_REQUIRED", "APPROVED", "PAYMENT_READY"].includes(p.status);
  const tone = TONE[p.status];
  const justPaid = p.status === "PAID" && Date.now() - new Date(p.updated_at).getTime() < 60_000;
  const steps = journey(p, "child");

  return (
    <main className="relative mx-auto max-w-md overflow-hidden px-4 pb-16">
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-br blur-2xl", GLOW[tone])} />
      {justPaid && <Confetti />}
      <TopBar name={user.displayName} role="child" />
      <StatusPoller purchaseId={p.id} active={open} />

      <Link href="/child" className="inline-flex items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <Icon icon={ArrowLeft01Icon} size={18} /> Shopping
      </Link>

      <FadeUp className="mt-4 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt={p.title} className="size-44 rotate-[-4deg] rounded-[32px] object-cover shadow-2xl ring-8 ring-white" />
        <p className="mt-6 text-[13px] font-semibold tracking-wide text-muted uppercase">{p.merchant}</p>
        <p className="text-[22px] font-semibold tracking-tight">{p.title}</p>
        <p className="tabular text-[17px] font-semibold text-blue">{ngn(p.price_kobo)}</p>
      </FadeUp>

      <FadeUp delay={0.1} className="mt-8">
        <JourneyPath steps={steps} />
      </FadeUp>

      <FadeUp delay={0.3} className="mt-8 text-center">
        <span className={cn(
          "inline-block rounded-full px-3 py-1 text-xs font-bold",
          tone === "go" ? "bg-blue text-white" : tone === "stop" ? "bg-stop text-white" : "bg-ink text-white",
        )}>
          {STATUS_LABEL[p.status]}
        </span>
        <p className="mx-auto mt-3 max-w-sm text-[24px] leading-tight font-semibold tracking-[-0.02em]">{headline(p.status, ngn(p.price_kobo), codes)}</p>
        {steps.at(-1)?.detail && <p className="mt-2 text-sm text-muted">{steps.at(-1)!.detail}</p>}
      </FadeUp>

      {(p.status === "AUTO_APPROVED" || p.status === "NEEDS_PARENT_APPROVAL") && (
        <FadeUp delay={0.4} className="mt-6">
          {p.status === "AUTO_APPROVED" && (
            <ActionButton url={`/api/purchases/${p.id}/execute`} variant="go">Pay {ngn(p.price_kobo)} from my allowance</ActionButton>
          )}
          {p.status === "NEEDS_PARENT_APPROVAL" && <ActionButton url={`/api/purchases/${p.id}/request-approval`}>Ask my parent</ActionButton>}
        </FadeUp>
      )}

      <FadeUp delay={0.45} className="mt-12">
        <h2 className="text-[17px] font-semibold">What LinkPass checked</h2>
        <p className="mb-4 text-sm text-muted">Your parent&apos;s rules, checked by code, not guessed by AI.</p>
        <Reasons codes={codes} />
      </FadeUp>
    </main>
  );
}
