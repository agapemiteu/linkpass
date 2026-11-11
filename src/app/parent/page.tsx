import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight01Icon, Notification03Icon, Store01Icon, Tag01Icon, Calendar03Icon, Wallet01Icon, ShoppingBag01Icon, Settings02Icon,
} from "@hugeicons/core-free-icons";
import { childOf, currentUser } from "@/lib/auth";
import { activity, familySummary, ngn, purchasesFor, STATUS_LABEL, TONE } from "@/lib/views";
import { Icon, TopBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FundForm } from "@/components/fund-form";
import { FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

const EVENT_TEXT: Record<string, string> = {
  PURCHASE_EVALUATED: "Checked a purchase against your rules",
  APPROVAL_REQUESTED: "Asked you to approve",
  PARENT_APPROVED: "You approved",
  PARENT_DECLINED: "You declined",
  FUNDS_RESERVED: "Money held for a payment",
  PAYMENT_CONFIRMED: "Bank confirmed a payment",
  PAYMENT_FAILED: "A payment failed",
  PAYMENT_REVERSED: "Bank reversed a payment",
  TRANSFER_OUTCOME_UNKNOWN: "Waiting on the bank",
  CHECKOUT_CREATED: "Checkout opened",
  ALLOWANCE_FUNDED: "Allowance topped up",
  POLICY_ACTIVATED: "Permissions updated",
  POLICY_REVOKED: "Permissions revoked",
};

function greeting() {
  const h = (new Date().getUTCHours() + 1) % 24; // Lagos time
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function ParentHome() {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN") redirect("/");
  const child = (await childOf(user.familyId))!;
  const { balances, policy, merchantNames } = await familySummary(child.id);
  const purchases = await purchasesFor(child.id, 20);
  const waiting = purchases.filter((p) => ["APPROVAL_REQUIRED", "APPROVED", "PAYMENT_READY"].includes(p.status));
  const events = await activity(child.id, 10);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <TopBar name={user.displayName} role="parent" />

      <FadeUp>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          {greeting()}, {user.displayName}.
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          {waiting.length ? `${waiting.length} request${waiting.length > 1 ? "s" : ""} waiting for you.` : `Nothing needs you right now. ${child.display_name} shops inside your rules.`}
        </p>
      </FadeUp>

      <div className="mt-5 space-y-3">
        {waiting.map((p, i) => (
          <FadeUp key={p.id} delay={0.05 + i * 0.06}>
            <Link href={`/parent/requests/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white transition active:scale-[0.99]">
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="" className="size-14 rounded-2xl object-cover" />
                <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-blue ring-2 ring-ink">
                  <Icon icon={Notification03Icon} size={13} />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{child.display_name} wants {p.title}</p>
                <p className="tabular text-sm text-white/60">{ngn(p.price_kobo)} · {STATUS_LABEL[p.status]}</p>
              </div>
              <Icon icon={ArrowRight01Icon} size={20} className="text-white/70" />
            </Link>
          </FadeUp>
        ))}
      </div>

      <FadeUp delay={0.1}>
        <Card className="mt-4 overflow-hidden p-0">
          <div className="relative h-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/mira.jpg" alt="" className="absolute inset-0 size-full object-cover object-[50%_25%]" />
            <span className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/0" />
            <div className="absolute bottom-3 left-5 text-white">
              <p className="text-[13px] text-white/75">{child.display_name}&apos;s allowance</p>
              <p className="tabular text-[2rem] leading-tight font-semibold tracking-tight">{ngn(balances.availableKobo)}</p>
            </div>
          </div>
          <div className="p-5 pt-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Funded", balances.fundedKobo],
                ["Held", balances.reservedKobo],
                ["Spent", balances.spentKobo],
              ].map(([label, v]) => (
                <div key={label} className="rounded-2xl bg-paper py-3">
                  <p className="tabular text-[15px] font-semibold">{ngn(v as number)}</p>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
            <FundForm />
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.16}>
        <Card className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[17px] font-semibold">Shopping permissions</p>
              <p className="text-sm text-muted">{policy ? `Version ${policy.version} · active` : "Not active"}</p>
            </div>
            <Link href="/parent/permissions" className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-3.5 py-2 text-sm font-semibold text-blue hover:bg-blue/15">
              <Icon icon={Settings02Icon} size={16} /> Edit
            </Link>
          </div>
          {policy ? (
            <ul className="mt-4 space-y-3 text-[15px]">
              <li className="flex items-center gap-3"><Icon icon={ShoppingBag01Icon} className="text-blue" /><span>Up to <b className="tabular">{ngn(policy.maximumSinglePurchaseKobo)}</b> per item, <b className="tabular">{ngn(policy.dailyLimitKobo)}</b> a day</span></li>
              <li className="flex items-center gap-3"><Icon icon={Store01Icon} className="text-blue" /><span>{merchantNames.map((m) => m.display_name).join(", ") || "No sellers approved"}</span></li>
              <li className="flex items-center gap-3"><Icon icon={Tag01Icon} className="text-blue" /><span className="capitalize">{policy.categories.join(", ") || "No categories"}</span></li>
              <li className="flex items-center gap-3"><Icon icon={Calendar03Icon} className="text-blue" /><span>Until {fmtDate(policy.expiresAt)}</span></li>
              <li className="flex items-center gap-3"><Icon icon={Notification03Icon} className="text-blue" /><span>Anything else comes to you</span></li>
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-muted">Every purchase will come to you until you activate permissions.</p>
          )}
        </Card>
      </FadeUp>

      {purchases.length > 0 && (
        <FadeUp delay={0.22}>
          <section className="mt-8">
            <h2 className="mb-3 text-[13px] font-medium text-muted">Purchases</h2>
            <Card className="divide-y divide-line p-0">
              {purchases.map((p) => (
                <Link key={p.id} href={`/parent/requests/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 transition first:rounded-t-3xl last:rounded-b-3xl hover:bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt="" className="size-11 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{p.title}</p>
                    <p className="tabular text-sm text-muted">{ngn(p.price_kobo)} · {p.merchant}</p>
                  </div>
                  <Badge tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </Link>
              ))}
            </Card>
          </section>
        </FadeUp>
      )}

      {events.length > 0 && (
        <FadeUp delay={0.28}>
          <section className="mt-8">
            <h2 className="mb-3 text-[13px] font-medium text-muted">Activity</h2>
            <Card className="space-y-3 text-[15px]">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2.5">
                    <Icon icon={e.event.startsWith("PAYMENT") || e.event === "FUNDS_RESERVED" ? Wallet01Icon : ShoppingBag01Icon} size={18} className="text-muted" />
                    {EVENT_TEXT[e.event] ?? e.event}
                  </span>
                  <time className="tabular shrink-0 text-sm text-muted">{new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
              ))}
            </Card>
          </section>
        </FadeUp>
      )}

      <Link href="/demo" className="mt-10 block text-center text-[13px] text-muted underline underline-offset-4">Demo tools</Link>
    </main>
  );
}
