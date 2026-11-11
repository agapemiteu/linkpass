"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckListIcon } from "@hugeicons/core-free-icons";
import { ActionButton } from "./action-button";
import { cn } from "@/lib/utils";

const CATEGORIES = ["clothing", "footwear", "accessories", "books", "groceries", "beauty", "electronics"];

type Initial = { maxSingle: number; daily: number; merchantIds: string[]; categories: string[]; days: number };

export function PermissionsForm({ childName, merchants, initial, hasPolicy }: { childName: string; merchants: { id: string; display_name: string; category: string }[]; initial: Initial; hasPolicy: boolean }) {
  const [v, setV] = useState(initial);
  const toggle = (key: "merchantIds" | "categories", item: string) =>
    setV((s) => ({ ...s, [key]: s[key].includes(item) ? s[key].filter((x) => x !== item) : [...s[key], item] }));
  const money = (n: number) => "₦" + n.toLocaleString("en-NG");
  const expires = new Date(Date.now() + v.days * 86400_000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mt-6 space-y-6">
      <Group title="Limits">
        <NumberField label="Per item, without asking" value={v.maxSingle} onChange={(n) => setV({ ...v, maxSingle: n })} />
        <NumberField label="Per day" value={v.daily} onChange={(n) => setV({ ...v, daily: n })} />
        <NumberField label="Valid for" suffix="days" value={v.days} onChange={(n) => setV({ ...v, days: n })} />
      </Group>

      <Group title="Approved sellers" note="Only verified LinkPass sellers appear here. Approval is tied to the seller's registered bank account.">
        {merchants.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center justify-between px-4 py-3.5">
            <span className="text-[15px]">
              {m.display_name} <span className="text-muted">· {m.category}</span>
            </span>
            <Switch on={v.merchantIds.includes(m.id)} onClick={() => toggle("merchantIds", m.id)} label={m.display_name} />
          </label>
        ))}
      </Group>

      <div>
        <p className="mb-2 px-1 text-[13px] font-medium text-muted">Categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle("categories", c)}
              className={cn("rounded-full px-4 py-2 text-[15px] font-medium capitalize transition", v.categories.includes(c) ? "bg-ink text-white" : "bg-card shadow-sm")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <p className="flex items-center gap-2 text-[17px] font-semibold">
          <HugeiconsIcon icon={CheckListIcon} size={20} /> Rules for {childName}
        </p>
        <ul className="mt-3 space-y-1.5 text-[15px] text-muted">
          <li>Can buy without asking, up to <b className="text-ink">{money(v.maxSingle)}</b> per item and <b className="text-ink">{money(v.daily)}</b> a day</li>
          <li>From <b className="text-ink">{merchants.filter((m) => v.merchantIds.includes(m.id)).map((m) => m.display_name).join(", ") || "no sellers"}</b></li>
          <li>In <b className="text-ink">{v.categories.join(", ") || "no categories"}</b></li>
          <li>Until <b className="text-ink">{expires}</b></li>
          <li>Everything else comes to you first</li>
        </ul>
      </section>

      <ActionButton
        url="/api/policies"
        payload={{ max_single_ngn: v.maxSingle, daily_limit_ngn: v.daily, merchant_ids: v.merchantIds, categories: v.categories, days: v.days }}
        then="/parent"
      >
        Activate permissions
      </ActionButton>
      {hasPolicy && (
        <ActionButton url="/api/policies" payload={{ action: "revoke" }} variant="danger" then="/parent" confirm="Turn off all automatic purchases?">
          Revoke permissions
        </ActionButton>
      )}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[13px] font-medium text-muted">{title}</p>
      <div className="divide-y divide-line rounded-3xl bg-card shadow-sm">{children}</div>
      {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cn("relative h-7 w-12 rounded-full transition", on ? "bg-go" : "bg-fill")}>
      <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition", on && "translate-x-5")} />
    </button>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-2">
      <span className="text-[15px]">{label}</span>
      <span className="flex items-center gap-1 rounded-full bg-paper px-3 py-1.5">
        {!suffix && <span className="text-muted">₦</span>}
        <input
          value={value}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
          inputMode="numeric"
          className="tabular w-20 bg-transparent text-right text-[15px] font-semibold outline-none"
        />
        {suffix && <span className="text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
