"use client";

import { useState } from "react";
import { ActionButton } from "./action-button";

export function FundForm() {
  const [amount, setAmount] = useState("50000");
  return (
    <details className="mt-4 border-t border-line pt-4">
      <summary className="cursor-pointer text-sm font-medium">Add to allowance</summary>
      <p className="mt-2 text-xs text-muted">
        Credited only after the bank confirms the controlled demo account holds enough to back every allowance.
      </p>
      <div className="mt-3 flex gap-2">
        <label className="flex h-12 flex-1 items-center rounded-xl border border-line px-3 focus-within:border-ink">
          <span className="text-muted">₦</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="tabular w-full bg-transparent pl-1 outline-none" aria-label="Amount in naira" />
        </label>
        <div className="w-32">
          <ActionButton url="/api/allowances/fund" payload={{ amount_ngn: Number(amount) }}>Add</ActionButton>
        </div>
      </div>
    </details>
  );
}
