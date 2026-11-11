"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Loading03Icon } from "@hugeicons/core-free-icons";

type Role = { id: string; name: string; sub: string; to: string; photo: string };

export function RoleChooser({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string, to: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", user_id: id }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error();
      router.push(to);
    } catch {
      setBusy(null);
      setError("Couldn't reach LinkPass. Try again.");
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => choose(r.id, r.to)}
            disabled={!!busy}
            className="group relative aspect-[3/4] overflow-hidden rounded-3xl text-left text-white transition active:scale-[0.98] disabled:opacity-70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.photo} alt="" className="absolute inset-0 size-full object-cover object-top transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4">
              <span className="flex items-center justify-between">
                <span className="text-[19px] font-semibold">{r.name}</span>
                <span className="grid size-8 place-items-center rounded-full bg-white text-ink">
                  <HugeiconsIcon icon={busy === r.id ? Loading03Icon : ArrowRight01Icon} size={16} className={busy === r.id ? "animate-spin" : ""} />
                </span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-white/80">{r.sub}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-stop" role="alert">{error}</p>}
    </div>
  );
}
