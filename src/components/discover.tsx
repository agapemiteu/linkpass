"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type ImportResult = {
  ai: { source: string; model?: string; error?: string; extraction: { product_title: string | null; claimed_price_ngn: number | null; missing_fields: string[] } | null };
  claimed_handle: string | null;
  match: {
    offer: { id: string; title: string; description: string; category: string; image_url: string; price_kobo: number };
    merchant: { id: string; display_name: string; verified: boolean };
    handle: string;
    matchedBy: string;
  } | null;
};

const SAMPLES = [
  { label: "Canvas sneakers · ₦15k", url: "https://www.instagram.com/osunthreads/p/canvas-sneakers" },
  { label: "Leather high-tops · ₦35k", url: "https://www.instagram.com/osunthreads/p/leather-hightops" },
  { label: "Lookalike shop", url: "https://www.instagram.com/osun.threadz/p/canvas-sneakers" },
];

const ngn = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

export function Discover() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function find(link = url) {
    setBusy(true);
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
      setError(e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!result?.match) return;
    setBusy(true);
    const res = await fetch("/api/purchases/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_id: result.match.offer.id, source_url: url || undefined, extracted: result.ai.extraction }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
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

  return (
    <div className="mt-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
        className="rounded-2xl border border-line bg-card p-2 focus-within:border-ink"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a product link"
          inputMode="url"
          className="h-12 w-full bg-transparent px-3 text-base outline-none placeholder:text-muted"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? (size, colour…)"
          className="h-10 w-full border-t border-line bg-transparent px-3 text-sm outline-none placeholder:text-muted"
        />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={() => file.current?.click()} className="h-11 rounded-xl border border-line px-4 text-sm font-medium hover:border-ink">
            {image ? "Screenshot added" : "Upload screenshot"}
          </button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button disabled={busy || (!url && !image)} className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-white disabled:opacity-50">
            {busy && !result ? "Reading…" : "Find this product"}
          </button>
        </div>
      </form>

      {!result && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                setUrl(s.url);
                find(s.url);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-stop" role="alert">{error}</p>}

      {result && !result.match && (
        <div className="mt-4 rounded-2xl border border-ask/30 bg-ask-soft p-5 text-sm">
          <p className="font-semibold text-ask">More information needed</p>
          <p className="mt-1">
            {result.claimed_handle ? `@${result.claimed_handle} isn't a LinkPass seller, or ` : ""}we couldn&apos;t match this to an item a seller has confirmed. Add a
            description or try another link.
          </p>
        </div>
      )}

      {result?.match && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.match.offer.image_url} alt={result.match.offer.title} className="aspect-[4/3] w-full object-cover" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{result.match.offer.title}</p>
                <p className="text-sm text-muted">{result.match.offer.description}</p>
              </div>
              <p className="tabular font-display text-2xl font-medium">{ngn(result.match.offer.price_kobo)}</p>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <p className="flex justify-between">
                <span className="text-muted">Seller</span>
                <span>
                  {result.match.merchant.display_name} · @{result.match.handle}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">LinkPass seller</span>
                <span className={result.match.merchant.verified ? "text-go" : "font-medium text-stop"}>
                  {result.match.merchant.verified ? "Registered" : "Not registered"}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">Price</span>
                <span>Confirmed by seller</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">Read by</span>
                <span>{result.ai.source === "unavailable" ? "Link only (AI offline)" : `Huawei ${result.ai.model ?? "MaaS"}`}</span>
              </p>
            </div>
            <button onClick={buy} disabled={busy} className="mt-5 h-12 w-full rounded-xl bg-ink text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Checking…" : "Buy with LinkPass"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
