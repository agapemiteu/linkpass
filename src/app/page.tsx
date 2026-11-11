import { CheckmarkCircle02Icon, SparklesIcon, Shield01Icon } from "@hugeicons/core-free-icons";
import { RoleChooser } from "@/components/role-chooser";
import { FadeUp } from "@/components/motion";
import { Reveal } from "@/components/reveal";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "child_001", name: "Mira", sub: "15 · spends from an allowance", to: "/child", photo: "/images/mira.jpg" },
  { id: "guardian_001", name: "Adaeze", sub: "Parent · sets the rules", to: "/parent", photo: "/images/adaeze.jpg" },
];

const CHAPTERS = [
  {
    n: "01",
    color: "bg-blue",
    title: "You set the rules once",
    text: "Pick the shops you trust, the categories, a per-item limit and a daily cap. Fund an allowance. That's it.",
    photo: "/images/adaeze.jpg",
    tag: "Parent",
  },
  {
    n: "02",
    color: "bg-coral",
    title: "They find something they love",
    text: "A post on Instagram, TikTok or WhatsApp. They paste the link and Huawei AI works out the product and the seller.",
    photo: "/images/teen.jpg",
    tag: "Child",
  },
  {
    n: "03",
    color: "bg-mint",
    title: "LinkPass checks, the bank pays",
    text: "Inside your rules, Access Bank pays the verified seller straight away. Outside them, it comes to you. Lookalike shops are blocked.",
    photo: null,
    tag: "Bank",
  },
];

function PaidMock() {
  return (
    <div className="relative mx-auto w-full max-w-xs rounded-[32px] bg-ink p-5 text-white shadow-2xl">
      <span aria-hidden className="absolute -top-6 -right-6 size-20 rounded-full bg-sun" />
      <div className="relative flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&q=80&auto=format&fit=crop" alt="" className="size-14 rounded-2xl object-cover" />
        <div>
          <p className="text-sm font-semibold">Canvas low-top sneakers</p>
          <p className="text-xs text-white/60">Ọ̀ṣun Threads · ₦15,000</p>
        </div>
      </div>
      <div className="mt-5 space-y-2.5 text-sm">
        {["Seller verified", "Inside every rule", "Bank confirmed"].map((t, i) => (
          <p key={t} className="flex items-center gap-2.5">
            <span className={cn("grid size-6 place-items-center rounded-full", ["bg-blue", "bg-lilac", "bg-mint"][i])}>
              <Icon icon={CheckmarkCircle02Icon} size={14} />
            </span>
            {t}
          </p>
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-semibold">Paid. No parent tap needed.</p>
    </div>
  );
}

export default function Welcome() {
  return (
    <main className="bg-white">
      {/* Opening */}
      <section className="lg:grid lg:min-h-dvh lg:grid-cols-2">
        <div className="relative h-[52dvh] overflow-hidden lg:h-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/family.jpg" alt="A mother and daughter looking at a phone together" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute top-5 left-5 flex items-center gap-2 text-white lg:top-8 lg:left-10">
            <span className="grid size-8 place-items-center rounded-lg bg-blue text-sm font-bold">L</span>
            <span className="text-[17px] font-semibold tracking-tight">LinkPass</span>
          </div>
          <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 lg:bottom-10 lg:left-10">
            {[
              [Shield01Icon, "Access Bank rails"],
              [SparklesIcon, "Huawei AI"],
            ].map(([icon, t]) => (
              <span key={t as string} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <Icon icon={icon as typeof Shield01Icon} size={14} /> {t as string}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto flex max-w-md flex-col justify-center overflow-hidden px-5 py-10 lg:max-w-lg lg:px-12">
          <span aria-hidden className="absolute -top-20 -right-20 size-60 rounded-full bg-sun/25 blur-3xl" />
          <FadeUp className="relative">
            <h1 className="text-[2.5rem] leading-[1.03] font-semibold tracking-[-0.035em] lg:text-[3.4rem]">
              Let your children shop independently, <span className="bg-gradient-to-r from-blue to-lilac bg-clip-text text-transparent">on your terms.</span>
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Kids find what they love online. You set the rules once. Everything inside the rules just works; everything else comes to you.
            </p>
          </FadeUp>
          <FadeUp delay={0.2} className="relative mt-8">
            <p className="mb-3 text-[13px] font-medium text-muted">Step in as · Demo Mode with sandbox money</p>
            <RoleChooser roles={ROLES} />
          </FadeUp>
        </div>
      </section>

      {/* The journey, told in three chapters */}
      <section className="relative mx-auto max-w-5xl px-5 py-20 lg:py-28">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="text-[13px] font-semibold tracking-wide text-blue uppercase">How it works</p>
          <h2 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.03em] lg:text-[2.6rem]">From a post they love to a paid order, in three moments.</h2>
        </Reveal>

        <div className="relative mt-16 space-y-20 lg:space-y-28">
          <span aria-hidden className="absolute top-0 bottom-0 left-[22px] w-0.5 border-l-2 border-dashed border-line lg:left-1/2" />
          {CHAPTERS.map((c, i) => (
            <div key={c.n} className={cn("relative grid items-center gap-8 pl-14 lg:grid-cols-2 lg:gap-16 lg:pl-0", i % 2 && "lg:[&>*:first-child]:order-2")}>
              <span className={cn("absolute top-0 left-0 grid size-11 place-items-center rounded-full text-sm font-bold text-white shadow-lg ring-4 ring-white lg:left-1/2 lg:-translate-x-1/2", c.color)}>
                {c.n}
              </span>
              <Reveal className={cn(i % 2 ? "lg:pl-16" : "lg:pr-16 lg:text-right")}>
                <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold text-white", c.color)}>{c.tag}</span>
                <h3 className="mt-3 text-[1.6rem] leading-tight font-semibold tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">{c.text}</p>
              </Reveal>
              <Reveal delay={0.1}>
                {c.photo ? (
                  <div className="relative">
                    <span aria-hidden className={cn("absolute -inset-3 rotate-3 rounded-[36px] opacity-25", c.color)} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photo} alt="" className="relative aspect-[4/3] w-full rounded-[32px] object-cover shadow-xl" />
                  </div>
                ) : (
                  <PaidMock />
                )}
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* Close */}
      <section className="bg-ink px-5 py-20 text-white">
        <Reveal className="mx-auto max-w-md text-center">
          <h2 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]">See it from both sides.</h2>
          <p className="mt-2 mb-8 text-white/70">Real sandbox bank transfers, real AI. Pick a person to start.</p>
          <RoleChooser roles={ROLES} />
          <p className="mt-8 text-xs text-white/50">Photos: Pexels and Unsplash. All accounts and money are synthetic sandbox data.</p>
        </Reveal>
      </section>
    </main>
  );
}
