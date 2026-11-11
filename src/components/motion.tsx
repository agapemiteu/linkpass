"use client";

import { motion, type HTMLMotionProps } from "motion/react";

// Small set of shared entrances so every screen moves the same way.
export function FadeUp({ delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      {...props}
    />
  );
}

export function Stagger({ children, className, step = 0.07 }: { children: React.ReactNode[]; className?: string; step?: number }) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <FadeUp key={i} delay={i * step}>
          {c}
        </FadeUp>
      ))}
    </div>
  );
}

export function ScaleIn({ delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, delay }}
      {...props}
    />
  );
}
