"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

type Role = { id: string; label: string; sub: string; to: string; avatar: ReactNode };

export function RoleChooser({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(id: string, to: string) {
    setBusy(id);
    await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", user_id: id }) });
    router.push(to);
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
      {roles.map((r, i) => (
        <button
          key={r.id}
          onClick={() => choose(r.id, r.to)}
          disabled={!!busy}
          className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-paper disabled:opacity-60 ${i > 0 ? "border-t border-line" : ""}`}
        >
          {r.avatar}
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">{r.label}</span>
            <span className="block text-sm text-muted">{busy === r.id ? "Opening…" : r.sub}</span>
          </span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted" />
        </button>
      ))}
    </div>
  );
}
