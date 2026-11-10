"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While a payment is open, ask the server (which asks the bank) every few seconds.
export function StatusPoller({ purchaseId, active }: { purchaseId: string; active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      await fetch(`/api/purchases/${purchaseId}`, { cache: "no-store" });
      router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [purchaseId, active, router]);
  return null;
}
