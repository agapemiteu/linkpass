"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";

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
  variant?: "primary" | "secondary" | "outline" | "danger" | "go";
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
      setError(e instanceof TypeError ? "Couldn't reach LinkPass. Check your connection and try again." : e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <Button onClick={run} disabled={busy} variant={variant}>
        {busy ? "Working…" : children}
      </Button>
      {error && <p className="mt-2 text-center text-sm text-stop" role="alert">{error}</p>}
    </div>
  );
}
