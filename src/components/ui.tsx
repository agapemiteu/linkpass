import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon, UserSwitchIcon, Clock01Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { REASON_TEXT, isPassing, type ReasonCode } from "@/lib/policies/evaluator";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { FadeUp } from "./motion";

export function Icon({ icon, size = 20, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} />;
}

export function TopBar({ name, role }: { name: string; role: "child" | "parent" }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between border-b border-transparent bg-paper/75 px-4 py-3 backdrop-blur-xl">
      <Link href={role === "child" ? "/child" : "/parent"} className="flex items-center gap-3">
        <Avatar seed={name} size={38} className="ring-2 ring-white" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">{name}</p>
          <p className="text-xs text-muted">{role === "child" ? "Shopper" : "Parent"}</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 text-[13px] font-semibold sm:flex">
          <span className="grid size-6 place-items-center rounded-md bg-blue text-[11px] font-bold text-white">L</span> LinkPass
        </span>
        <Link href="/" aria-label="Switch person" className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-sm hover:text-ink">
          <Icon icon={UserSwitchIcon} size={19} />
        </Link>
      </div>
    </header>
  );
}

export function Reasons({ codes }: { codes: ReasonCode[] }) {
  return (
    <ul className="space-y-2.5">
      {codes.map((c, i) => {
        const ok = isPassing(c);
        return (
          <FadeUp key={c} delay={0.2 + i * 0.09}>
            <li className="flex items-center gap-3 text-[15px]">
              <Icon icon={ok ? CheckmarkCircle02Icon : CancelCircleIcon} size={20} className={ok ? "text-blue" : "text-stop"} />
              <span className={ok ? "" : "font-medium"}>{REASON_TEXT[c]}</span>
            </li>
          </FadeUp>
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
const STEP_DOT = {
  done: "bg-blue text-white",
  current: "bg-ink text-white",
  waiting: "bg-fill text-ink",
  failed: "bg-stop text-white",
  todo: "bg-fill text-muted",
};

// Vertical progress timeline; each row arrives in order.
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <FadeUp key={s.title} delay={0.1 + i * 0.12}>
          <li className="relative flex gap-3.5 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className={cn("absolute top-9 left-[15px] h-[calc(100%-32px)] w-0.5 rounded", s.state === "done" ? "bg-blue" : "bg-line")} />
            )}
            <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", STEP_DOT[s.state])}>
              {s.state === "current" && <span className="absolute inset-0 animate-ping rounded-full bg-ink/30" />}
              <Icon icon={STEP_ICON[s.state]} size={17} />
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-[15px] font-semibold", s.state === "todo" && "font-medium text-muted")}>{s.title}</p>
              {s.detail && <p className="text-sm break-words text-muted">{s.detail}</p>}
            </div>
          </li>
        </FadeUp>
      ))}
    </ol>
  );
}
