import Link from "next/link";
import { redirect } from "next/navigation";
import { Store01Icon } from "@hugeicons/core-free-icons";
import { currentUser } from "@/lib/auth";
import { familySummary, ngn, purchasesFor, STATUS_LABEL, TONE } from "@/lib/views";
import { Icon, TopBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Discover } from "@/components/discover";
import { FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function ChildHome() {
  const user = await currentUser();
  if (user?.role !== "CHILD") redirect("/");
  const { balances, policy, merchantNames } = familySummary(user.id);
  const purchases = purchasesFor(user.id, 10);
  const used = balances.fundedKobo ? Math.round(((balances.spentKobo + balances.reservedKobo) / balances.fundedKobo) * 100) : 0;

  return (
    <main className="relative mx-auto max-w-md overflow-hidden px-4 pb-16">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 -z-10 size-72 rounded-full bg-sun/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-40 -right-28 -z-10 size-72 rounded-full bg-lilac/25 blur-3xl" />
      <TopBar name={user.displayName} role="child" />

      <FadeUp>
        <p className="text-[15px] font-medium text-muted">Hey {user.displayName}</p>
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">What are you shopping for today?</h1>
      </FadeUp>

      <FadeUp delay={0.08} className="mt-5">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-blue via-blue-deep to-lilac p-6 text-white shadow-xl shadow-blue/25">
          <span aria-hidden className="absolute -right-8 -bottom-10 size-36 rounded-full bg-sun/90" />
          <span aria-hidden className="absolute right-20 -bottom-14 size-24 rounded-full bg-coral/90" />
          <span aria-hidden className="absolute top-5 right-6 size-10 rounded-full border-4 border-white/30" />
          <p className="relative text-[13px] font-semibold tracking-wide text-white/75 uppercase">My LinkPass</p>
          <p className="tabular relative mt-1 text-[2.7rem] leading-none font-semibold tracking-tight">{ngn(balances.availableKobo)}</p>
          <p className="relative mt-1 text-sm text-white/80">ready to spend</p>
          <div className="relative mt-5 h-2 w-3/4 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${used}%` }} />
          </div>
          <p className="relative mt-2 w-3/4 text-[13px] text-white/80">
            {policy ? `Up to ${ngn(policy.maximumSinglePurchaseKobo)} an item without asking` : "Every purchase needs your parent right now"}
          </p>
          {policy && merchantNames.length > 0 && (
            <div className="relative mt-4 flex flex-wrap gap-2">
              {merchantNames.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <Icon icon={Store01Icon} size={14} /> {m.display_name}
                </span>
              ))}
            </div>
          )}
        </section>
      </FadeUp>

      <FadeUp delay={0.16} className="mt-9">
        <h2 className="text-[19px] font-semibold tracking-tight">Found something you love?</h2>
        <p className="text-[15px] text-muted">Paste the link from Instagram, TikTok or WhatsApp.</p>
        <Discover />
      </FadeUp>

      {purchases.length > 0 && (
        <FadeUp delay={0.24} className="mt-10">
          <h2 className="mb-3 text-[19px] font-semibold tracking-tight">Your finds</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {purchases.map((p) => (
              <Link key={p.id} href={`/child/p/${p.id}`} className="group w-40 shrink-0 snap-start">
                <div className="relative overflow-hidden rounded-3xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt="" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                  <Badge tone={TONE[p.status]} className="absolute top-2 left-2 bg-white/95 shadow-sm">{STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="mt-2 truncate text-[15px] font-semibold">{p.title}</p>
                <p className="tabular text-sm text-muted">{ngn(p.price_kobo)}</p>
              </Link>
            ))}
          </div>
        </FadeUp>
      )}
    </main>
  );
}
