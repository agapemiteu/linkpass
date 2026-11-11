import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { familySummary, ngn, purchasesFor, STATUS_LABEL, TONE } from "@/lib/views";
import { Icon, TopBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Discover } from "@/components/discover";

export const dynamic = "force-dynamic";

export default async function ChildHome() {
  const user = await currentUser();
  if (user?.role !== "CHILD") redirect("/");
  const { balances, policy, merchantNames } = familySummary(user.id);
  const purchases = purchasesFor(user.id, 8);

  return (
    <main>
      <TopBar name={user.displayName} role="child" />

      <section className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-[13px] font-medium text-white/60">You can spend</p>
        <p className="tabular mt-1 text-[2.4rem] leading-none font-semibold tracking-tight">{ngn(balances.availableKobo)}</p>
        <div className="mt-5 flex items-center justify-between text-sm text-white/70">
          <span>{policy ? `Up to ${ngn(policy.maximumSinglePurchaseKobo)} per item on your own` : "Every purchase needs your parent"}</span>
        </div>
        {policy && merchantNames.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {merchantNames.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
                <Icon icon={Store01Icon} size={14} /> {m.display_name}
              </span>
            ))}
          </div>
        )}
      </section>

      <h1 className="mt-8 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">Found something you love?</h1>
      <p className="mt-1 text-[15px] text-muted">Paste the link from Instagram, TikTok or WhatsApp.</p>
      <Discover />

      {purchases.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-medium text-muted">Your purchases</h2>
          <Card className="divide-y divide-line p-0">
            {purchases.map((p) => (
              <Link key={p.id} href={`/child/p/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 transition first:rounded-t-3xl last:rounded-b-3xl hover:bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="" className="size-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{p.title}</p>
                  <p className="tabular text-sm text-muted">{ngn(p.price_kobo)}</p>
                </div>
                <Badge tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                <Icon icon={ArrowRight01Icon} size={18} className="text-muted" />
              </Link>
            ))}
          </Card>
        </section>
      )}
    </main>
  );
}
