"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Link01Icon, Image01Icon, CheckmarkCircle02Icon, Alert02Icon, SparklesIcon, Store01Icon, Tag01Icon, Cancel01Icon, Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type Match = {
  offer: { id: string; title: string; description: string; category: string; image_url: string; price_kobo: number };
  merchant: { id: string; display_name: string; verified: boolean };
  handle: string;
  trust: { rating: number | null; reviews: number; sales: number; tradingSince: string; cacRegistered: boolean; scamReports: number };
};

type ImportResult = {
  alternatives: Match[];
  ai: { source: string; model?: string; error?: string; extraction: { product_title: string | null; missing_fields: string[] } | null };
  claimed_handle: string | null;
  match: Match | null;
};

const SAMPLES = [
  { label: "Canvas sneakers", note: "₦15k", url: "https://www.instagram.com/osunthreads/p/canvas-sneakers" },
  { label: "Red sneakers", note: "₦35k", url: "https://www.instagram.com/osunthreads/p/leather-hightops" },
  { label: "Lookalike shop", note: "test", url: "https://www.instagram.com/osun.threadz/p/canvas-sneakers" },
];

const READING = ["Reading the post", "Identifying the product", "Checking sellers across the web", "Confirming the safest price"];
const ease = [0.22, 1, 0.36, 1] as const;
const ngn = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

export function Discover() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "buying">("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Walks the progress list while the AI works; the last step waits for the real answer.
  useEffect(() => {
    if (phase !== "reading") return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, READING.length - 1)), 900);
    return () => clearInterval(t);
  }, [phase]);

  async function find(link = url) {
    setPhase("reading");
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: link || undefined, description: note || undefined, image: image ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Let the steps play through once so the result doesn't just blink in.
      await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))));
      setResult(data);
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach LinkPass. Try again." : e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setPhase("idle");
    }
  }

  async function buy(offerId = result?.match?.offer.id) {
    if (!result || !offerId) return;
    setPhase("buying");
    const res = await fetch("/api/purchases/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_id: offerId, source_url: url || undefined, extracted: result.ai.extraction }),
    }).catch(() => null);
    const data = res ? await res.json() : { error: "Couldn't reach LinkPass. Try again." };
    if (!res?.ok) {
      setError(data.error);
      setPhase("idle");
      return;
    }
    router.push(`/child/p/${data.purchase_request_id}`);
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return setError("Screenshot must be under 2 MB");
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(f);
  }

  function clear() {
    setResult(null);
    setUrl("");
    setNote("");
    setImage(null);
    setError(null);
  }

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait">
        {!result && phase !== "reading" && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                find();
              }}
              className="rounded-3xl bg-card p-2 shadow-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-blue"
            >
              <label className="flex items-center gap-3 px-3">
                <HugeiconsIcon icon={Link01Icon} size={20} className="text-blue" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a product link"
                  inputMode="url"
                  className="h-12 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
                />
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Size, colour, anything else (optional)"
                className="h-11 w-full border-t border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-muted"
              />
              <div className="flex gap-2 p-1 pt-2">
                <button
                  type="button"
                  onClick={() => file.current?.click()}
                  aria-label="Upload screenshot"
                  className={cn("grid size-12 shrink-0 place-items-center rounded-full bg-fill transition hover:bg-line", image && "bg-blue-soft text-blue")}
                >
                  <HugeiconsIcon icon={image ? CheckmarkCircle02Icon : Image01Icon} size={20} />
                </button>
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <Button disabled={!url && !image} className="bg-blue hover:bg-blue-deep">
                  <HugeiconsIcon icon={SparklesIcon} size={18} /> Find this product
                </Button>
              </div>
            </form>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {SAMPLES.map((s) => (
                <button
                  key={s.url}
                  onClick={() => {
                    setUrl(s.url);
                    find(s.url);
                  }}
                  className="shrink-0 rounded-full bg-card px-3.5 py-2 text-[13px] font-medium shadow-sm ring-1 ring-line transition hover:ring-blue"
                >
                  {s.label} <span className="text-muted">· {s.note}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "reading" && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-line"
          >
            <div className="scan relative h-36 overflow-hidden bg-ink">
              <div className="absolute inset-0 grid place-items-center">
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white">
                  <HugeiconsIcon icon={SparklesIcon} size={16} className="text-blue" /> Huawei AI is reading the post
                </span>
              </div>
            </div>
            <ol className="space-y-3 p-5" aria-live="polite">
              {READING.map((label, i) => (
                <li key={label} className={cn("flex items-center gap-3 text-[15px] transition duration-300", i > step && "opacity-30")}>
                  <HugeiconsIcon
                    icon={i < step ? CheckmarkCircle02Icon : Loading03Icon}
                    size={20}
                    className={cn(i < step ? "text-blue" : "text-muted", i === step && "animate-spin")}
                  />
                  <span className={i <= step ? "font-medium" : ""}>{label}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {result && !result.match && (
          <motion.div key="nomatch" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line">
            <p className="flex items-center gap-2 font-semibold">
              <HugeiconsIcon icon={Alert02Icon} size={20} /> More information needed
            </p>
            <p className="mt-2 text-[15px] text-muted">
              {result.claimed_handle ? `@${result.claimed_handle} isn't a LinkPass seller, or ` : ""}we couldn&apos;t match this to an item a seller has confirmed.
            </p>
            <Button variant="outline" className="mt-4" onClick={clear}>Try another link</Button>
          </motion.div>
        )}

        {result?.match && (
          <motion.div
            key="match"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-line"
          >
            <div className="relative">
              <motion.img
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.9, ease }}
                src={result.match.offer.image_url}
                alt={result.match.offer.title}
                className="aspect-[4/3] w-full object-cover"
              />
              <button onClick={clear} aria-label="Close" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <HugeiconsIcon icon={SparklesIcon} size={14} className="text-blue" />
                {result.ai.source === "unavailable" ? "Matched from the link" : "Identified by Huawei AI"}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[19px] font-semibold tracking-tight">{result.match.offer.title}</p>
                  <p className="text-[15px] text-muted">{result.match.offer.description}</p>
                </div>
                <p className="tabular text-[22px] font-semibold">{ngn(result.match.offer.price_kobo)}</p>
              </div>
              <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-[15px]">
                {[
                  { icon: Store01Icon, text: <>{result.match.merchant.display_name} <span className="text-muted">@{result.match.handle}</span></>, tone: "" },
                  result.match.merchant.verified
                    ? { icon: CheckmarkCircle02Icon, text: <span className="font-medium">Registered LinkPass seller</span>, tone: "text-blue" }
                    : { icon: Alert02Icon, text: <span className="font-medium">Not a registered seller</span>, tone: "text-stop" },
                  result.match.merchant.verified
                    ? { icon: Tag01Icon, text: <>Price confirmed by the seller</>, tone: "" }
                    : {
                        icon: Alert02Icon,
                        text: (
                          <>
                            Opened {result.match.trust.tradingSince} · {result.match.trust.sales ? `${result.match.trust.sales} sales` : "no sales history"}
                            {result.match.trust.scamReports ? ` · ${result.match.trust.scamReports} scam reports` : ""}
                          </>
                        ),
                        tone: "text-stop",
                      },
                ].map((row, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.1, duration: 0.35, ease }}
                    className={cn("flex items-center gap-3", row.tone)}
                  >
                    <HugeiconsIcon icon={row.icon} size={20} className={row.tone ? "" : "text-muted"} />
                    <span className="flex-1">{row.text}</span>
                  </motion.li>
                ))}
              </ul>
              <Button
                className="mt-5"
                variant={result.match.merchant.verified ? "primary" : "outline"}
                onClick={() => buy()}
                disabled={phase === "buying"}
              >
                {phase === "buying" ? "Checking your rules…" : result.match.merchant.verified ? "Buy with LinkPass" : "Check this seller anyway"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && result.alternatives.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45, ease }}
          className="mt-4 rounded-3xl bg-blue-soft p-4 ring-1 ring-blue/20"
        >
          <p className="flex items-center gap-2 px-1 text-[15px] font-semibold text-blue">
            <HugeiconsIcon icon={SparklesIcon} size={18} /> Safer option: same item from a verified seller
          </p>
          <p className="mt-0.5 px-1 text-xs text-blue/70">Picked by track record across the web · simulated for demo</p>
          <div className="mt-3 space-y-3">
            {result.alternatives.map((alt) => (
              <div key={alt.offer.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={alt.offer.image_url} alt="" className="size-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{alt.offer.title}</p>
                  <p className="flex items-center gap-1 text-sm text-blue">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} /> {alt.merchant.display_name}
                  </p>
                  <p className="text-xs text-muted">
                    ★ {alt.trust.rating ?? "–"} · {alt.trust.sales.toLocaleString()} sales · {alt.trust.cacRegistered ? "CAC-registered" : "unregistered"} · since {alt.trust.tradingSince}
                  </p>
                  <p className="tabular text-sm font-semibold">{ngn(alt.offer.price_kobo)}</p>
                </div>
                <button
                  onClick={() => buy(alt.offer.id)}
                  disabled={phase === "buying"}
                  className="h-10 shrink-0 rounded-full bg-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Buy safely
                </button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {error && <p className="mt-3 text-sm text-stop" role="alert">{error}</p>}
    </div>
  );
}
