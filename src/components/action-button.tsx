"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

// POSTs to an API route, then refreshes or navigates. Errors show inline.
export function ActionButton({
  url,
  payload,
  children,
  variant = "primary",
  then,
  confirm,
}: {
  url: string;
  payload?: unknown;
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  then?: string | "open-payment";
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (then === "open-payment" && data.paymentUrl) window.location.href = data.paymentUrl;
      else if (then) router.push(then);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const style = {
    primary: "bg-ink text-white hover:bg-black",
    ghost: "border border-line bg-card hover:border-ink",
    danger: "border border-stop/30 bg-card text-stop hover:border-stop",
  }[variant];

  return (
    <div className="w-full">
      <button onClick={run} disabled={busy} className={`h-12 w-full rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${style}`}>
        {busy ? "Working…" : children}
      </button>
      {error && <p className="mt-2 text-sm text-stop" role="alert">{error}</p>}
    </div>
  );
}
