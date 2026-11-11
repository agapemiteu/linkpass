"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Link01Icon, Image01Icon, CheckmarkCircle02Icon, Alert02Icon, SparklesIcon, Store01Icon, Tag01Icon, Cancel01Icon, Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type ImportResult = {
  ai: { source: string; model?: string; error?: string; extraction: { product_title: string | null; missing_fields: string[] } | null };
  claimed_handle: string | null;
  match: {
    offer: { id: string; title: string; description: string; category: string; image_url: string; price_kobo: number };
    merchant: { id: string; display_name: string; verified: boolean };
    handle: string;
  } | null;
};

const SAMPLES = [
  { label: "Canvas sneakers", note: "₦15k", url: "https://www.instagram.com/osunthreads/p/canvas-sneakers" },
  { label: "Red sneakers", note: "₦35k", url: "https://www.instagram.com/osunthreads/p/leather-hightops" },
  { label: "Lookalike shop", note: "test", url: "https://www.instagram.com/osun.threadz/p/canvas-sneakers" },
];

const READING = ["Reading the post", "Identifying the product", "Finding the seller", "Confirming the price"];

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
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: link || undefined, description: note || undefined, image: image ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach LinkPass. Try again." : e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setPhase("idle");
    }
  }

  async function buy() {
    if (!result?.match) return;
    setPhase("buying");
    const res = await fetch("/api/purchases/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_id: result.match.offer.id, source_url: url || undefined, extracted: result.ai.extraction }),
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
      {!result && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
          className="rounded-3xl bg-card p-2 shadow-sm"
        >
          <label className="flex items-center gap-3 px-3">
            <HugeiconsIcon icon={Link01Icon} size={20} className="text-muted" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a product link"
              inputMode="url"
              disabled={phase !== "idle"}
              className="h-12 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Size, colour, anything else (optional)"
            disabled={phase !== "idle"}
            className="h-11 w-full border-t border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-muted"
          />
          {phase === "reading" ? (
            <ol className="space-y-2.5 px-4 py-4" aria-live="polite">
              {READING.map((label, i) => (
                <li key={label} className={cn("flex items-center gap-3 text-[15px] transition", i > step && "opacity-35")}>
                  <HugeiconsIcon
                    icon={i < step ? CheckmarkCircle02Icon : Loading03Icon}
                    size={20}
                    className={cn(i < step ? "text-go" : "text-muted", i === step && "animate-spin")}
                  />
                  {label}
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex gap-2 p-1 pt-2">
              <button
                type="button"
                onClick={() => file.current?.click()}
                aria-label="Upload screenshot"
                className={cn("grid size-12 shrink-0 place-items-center rounded-full bg-fill", image && "bg-go-soft text-go")}
              >
                <HugeiconsIcon icon={image ? CheckmarkCircle02Icon : Image01Icon} size={20} />
              </button>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <Button disabled={!url && !image}>
                <HugeiconsIcon icon={SparklesIcon} size={18} /> Find this product
              </Button>
            </div>
          )}
        </form>
      )}

      {!result && phase === "idle" && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                setUrl(s.url);
                find(s.url);
              }}
              className="shrink-0 rounded-full bg-card px-3.5 py-2 text-[13px] font-medium shadow-sm hover:bg-fill"
            >
              {s.label} <span className="text-muted">· {s.note}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-stop" role="alert">{error}</p>}

      {result && !result.match && (
        <div className="rise rounded-3xl bg-ask-soft p-5">
          <p className="flex items-center gap-2 font-semibold text-ask">
            <HugeiconsIcon icon={Alert02Icon} size={20} /> More information needed
          </p>
          <p className="mt-2 text-[15px]">
            {result.claimed_handle ? `@${result.claimed_handle} isn't a LinkPass seller, or ` : ""}we couldn&apos;t match this to an item a seller has confirmed.
          </p>
          <Button variant="outline" className="mt-4" onClick={clear}>Try another link</Button>
        </div>
      )}

      {result?.match && (
        <div className="rise overflow-hidden rounded-3xl bg-card shadow-sm">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.match.offer.image_url} alt={result.match.offer.title} className="aspect-[4/3] w-full object-cover" />
            <button onClick={clear} aria-label="Close" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <HugeiconsIcon icon={SparklesIcon} size={14} />
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
              <li className="flex items-center gap-3">
                <HugeiconsIcon icon={Store01Icon} size={20} className="text-muted" />
                <span className="flex-1">{result.match.merchant.display_name} <span className="text-muted">@{result.match.handle}</span></span>
              </li>
              <li className={cn("flex items-center gap-3", result.match.merchant.verified ? "text-go" : "text-stop")}>
                <HugeiconsIcon icon={result.match.merchant.verified ? CheckmarkCircle02Icon : Alert02Icon} size={20} />
                <span className="font-medium">{result.match.merchant.verified ? "Registered LinkPass seller" : "Not a registered seller"}</span>
              </li>
              <li className="flex items-center gap-3">
                <HugeiconsIcon icon={Tag01Icon} size={20} className="text-muted" />
                <span>Price confirmed by the seller</span>
              </li>
            </ul>
            <Button className="mt-5" onClick={buy} disabled={phase === "buying"}>
              {phase === "buying" ? "Checking your rules…" : "Buy with LinkPass"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
