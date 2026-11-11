"use client";

import { useState } from "react";
import { ActionButton } from "./action-button";

export function FundForm() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("50000");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 h-11 w-full rounded-full bg-fill text-[15px] font-semibold hover:bg-line">
        Add money
      </button>
    );
  }
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <label className="flex h-12 flex-1 items-center rounded-full bg-paper px-4">
          <span className="text-muted">₦</span>
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="tabular w-full bg-transparent pl-1 text-[17px] outline-none"
            aria-label="Amount in naira"
          />
        </label>
        <div className="w-28">
          <ActionButton url="/api/allowances/fund" payload={{ amount_ngn: Number(amount) }}>Add</ActionButton>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Added only after the bank confirms the demo account holds enough to cover every allowance.</p>
    </div>
  );
}
