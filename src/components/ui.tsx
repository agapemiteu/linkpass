import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon, UserSwitchIcon, Clock01Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { REASON_TEXT, isPassing, type ReasonCode } from "@/lib/policies/evaluator";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export function Icon({ icon, size = 20, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} />;
}

export function TopBar({ name, role }: { name: string; role: "child" | "parent" }) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-2 flex items-center justify-between bg-paper/80 px-4 py-3 backdrop-blur-xl">
      <Link href={role === "child" ? "/child" : "/parent"} className="flex items-center gap-3">
        <Avatar seed={name} size={36} />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">{name}</p>
          <p className="text-xs text-muted">{role === "child" ? "Shopper" : "Parent"}</p>
        </div>
      </Link>
      <Link href="/" aria-label="Switch person" className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-sm hover:text-ink">
        <Icon icon={UserSwitchIcon} size={19} />
      </Link>
    </header>
  );
}

export function Reasons({ codes }: { codes: ReasonCode[] }) {
  return (
    <ul className="space-y-2.5">
      {codes.map((c, i) => {
        const ok = isPassing(c);
        return (
          <li key={c} className="rise flex items-center gap-3 text-[15px]" style={{ animationDelay: `${i * 90}ms` }}>
            <Icon icon={ok ? CheckmarkCircle02Icon : CancelCircleIcon} size={20} className={ok ? "text-go" : "text-stop"} />
            <span className={ok ? "" : "font-medium"}>{REASON_TEXT[c]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="tabular text-right font-medium">{children}</span>
    </div>
  );
}

export type StepState = "done" | "current" | "waiting" | "failed" | "todo";
export type Step = { title: string; detail?: string; state: StepState };

const STEP_ICON = { done: CheckmarkCircle02Icon, current: Clock01Icon, waiting: Clock01Icon, failed: Alert02Icon, todo: Clock01Icon };
const STEP_TONE = { done: "text-go", current: "text-ink", waiting: "text-ask", failed: "text-stop", todo: "text-line" };

// Vertical progress timeline, one row per stage of a purchase.
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden className={cn("absolute top-7 left-[11px] h-[calc(100%-24px)] w-0.5 rounded", s.state === "done" ? "bg-go/40" : "bg-line")} />
          )}
          <span className={cn("grid size-6 shrink-0 place-items-center", STEP_TONE[s.state], s.state === "current" && "animate-pulse")}>
            <Icon icon={STEP_ICON[s.state]} size={24} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-[15px] font-semibold", s.state === "todo" && "text-muted font-medium")}>{s.title}</p>
            {s.detail && <p className="text-sm text-muted">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
