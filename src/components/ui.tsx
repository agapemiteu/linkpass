import Link from "next/link";
import type { ReactNode } from "react";
import { REASON_TEXT, isPassing, type ReasonCode } from "@/lib/policies/evaluator";

const TONES = {
  go: "bg-go-soft text-go",
  ask: "bg-ask-soft text-ask",
  stop: "bg-stop-soft text-stop",
  neutral: "bg-line text-muted",
};

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</section>;
}

export function TopBar({ name, role }: { name: string; role: "child" | "parent" }) {
  return (
    <header className="flex items-center justify-between py-5">
      <Link href={role === "child" ? "/child" : "/parent"} className="font-display text-xl font-semibold tracking-tight">
        LinkPass
      </Link>
      <Link href="/" className="text-sm text-muted hover:text-ink">
        {name} · {role === "child" ? "Child" : "Parent"} <span aria-hidden>↺</span>
      </Link>
    </header>
  );
}

export function Reasons({ codes }: { codes: ReasonCode[] }) {
  return (
    <ul className="space-y-2">
      {codes.map((c) => {
        const ok = isPassing(c);
        return (
          <li key={c} className="flex items-start gap-3 text-sm">
            <span
              aria-hidden
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? "bg-go text-white" : "bg-stop text-white"}`}
            >
              {ok ? "✓" : "✕"}
            </span>
            <span className={ok ? "" : "font-medium"}>{REASON_TEXT[c]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular text-right font-medium">{children}</span>
    </div>
  );
}
