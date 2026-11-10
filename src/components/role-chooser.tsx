"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  { id: "guardian_001", label: "I'm a parent", sub: "Adaeze", to: "/parent" },
  { id: "child_001", label: "I'm a child", sub: "Mira, 15", to: "/child" },
];

export function RoleChooser() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(id: string, to: string) {
    setBusy(id);
    await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", user_id: id }) });
    router.push(to);
  }

  return (
    <div className="grid gap-3">
      {ROLES.map((r) => (
        <button
          key={r.id}
          onClick={() => choose(r.id, r.to)}
          disabled={!!busy}
          className="flex h-16 items-center justify-between rounded-2xl border border-line bg-card px-5 text-left transition hover:border-ink disabled:opacity-60"
        >
          <span className="font-semibold">{r.label}</span>
          <span className="text-sm text-muted">{busy === r.id ? "Opening…" : r.sub}</span>
        </button>
      ))}
    </div>
  );
}
