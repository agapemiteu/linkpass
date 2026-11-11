"use client";

import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import type { Step } from "./ui";
import { cn } from "@/lib/utils";

const COLORS = ["bg-blue", "bg-lilac", "bg-coral", "bg-sun", "bg-mint"];

// A horizontal trail: dots light up in colour as the purchase moves forward.
export function JourneyPath({ steps }: { steps: Step[] }) {
  const reached = steps.filter((s) => s.state === "done").length;
  const progress = steps.length > 1 ? Math.min(reached, steps.length - 1) / (steps.length - 1) : 1;
  return (
    <div className="relative px-3 pt-2 pb-1">
      <div className="absolute top-[22px] right-6 left-6 h-1 rounded-full bg-black/10" />
      <motion.div
        className="absolute top-[22px] left-6 h-1 rounded-full bg-gradient-to-r from-blue via-lilac to-coral"
        initial={{ width: 0 }}
        animate={{ width: `calc((100% - 48px) * ${progress})` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      />
      <ol className="relative flex justify-between">
        {steps.map((s, i) => (
          <li key={s.title} className="flex w-16 flex-col items-center text-center">
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.25 + i * 0.18 }}
              className={cn(
                "relative grid size-10 place-items-center rounded-full text-white shadow-md ring-4 ring-white",
                s.state === "done" ? COLORS[i % COLORS.length] : s.state === "failed" ? "bg-stop" : s.state === "todo" ? "bg-white text-muted shadow-none ring-black/5" : "bg-ink",
              )}
            >
              {(s.state === "current" || s.state === "waiting") && <span className="absolute inset-0 animate-ping rounded-full bg-ink/25" />}
              {s.state === "done" ? (
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />
              ) : s.state === "failed" ? (
                <HugeiconsIcon icon={Alert02Icon} size={20} />
              ) : (
                <span className="text-sm font-bold">{i + 1}</span>
              )}
            </motion.span>
            <span className={cn("mt-2 text-[11px] leading-tight font-semibold", s.state === "todo" && "text-muted")}>{s.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
