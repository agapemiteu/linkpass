"use client";

import { useState } from "react";
import { ActionButton } from "./action-button";

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
      <NumberField label="Maximum automatic purchase" value={v.maxSingle} onChange={(n) => setV({ ...v, maxSingle: n })} />
      <NumberField label="Daily limit" value={v.daily} onChange={(n) => setV({ ...v, daily: n })} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Approved sellers</legend>
        <div className="space-y-2">
          {merchants.map((m) => (
            <label key={m.id} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm">
              <span>{m.display_name} <span className="text-muted">· {m.category}</span></span>
              <input type="checkbox" checked={v.merchantIds.includes(m.id)} onChange={() => toggle("merchantIds", m.id)} className="size-5 accent-ink" />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Only verified LinkPass sellers appear here. Approval is tied to the seller&apos;s registered bank account.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle("categories", c)}
              className={`rounded-full border px-3 py-1.5 text-sm ${v.categories.includes(c) ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <NumberField label="Valid for (days)" value={v.days} onChange={(n) => setV({ ...v, days: n })} prefix="" />

      <section className="rounded-2xl border border-line bg-card p-5 text-sm">
        <p className="font-semibold">Shopping permissions for {childName}</p>
        <ul className="mt-2 space-y-1 text-muted">
          <li>Maximum automatic purchase: <span className="text-ink">{money(v.maxSingle)}</span></li>
          <li>Daily limit: <span className="text-ink">{money(v.daily)}</span></li>
          <li>Approved sellers: <span className="text-ink">{merchants.filter((m) => v.merchantIds.includes(m.id)).map((m) => m.display_name).join(", ") || "none"}</span></li>
          <li>Categories: <span className="text-ink">{v.categories.join(", ") || "none"}</span></li>
          <li>Expiry: <span className="text-ink">{expires}</span></li>
          <li>Purchases outside these conditions: <span className="text-ink">ask parent</span></li>
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
        <ActionButton url="/api/policies" payload={{ action: "revoke" }} variant="danger" then="/parent" confirm="Revoke all automatic purchases?">
          Revoke permissions
        </ActionButton>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, prefix = "₦" }: { label: string; value: number; onChange: (n: number) => void; prefix?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <span className="flex h-12 items-center rounded-xl border border-line bg-card px-4 focus-within:border-ink">
        {prefix && <span className="text-muted">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
          inputMode="numeric"
          className="tabular w-full bg-transparent pl-1 outline-none"
        />
      </span>
    </label>
  );
}
