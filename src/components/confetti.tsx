"use client";

import { motion } from "motion/react";

const COLORS = ["#1f5eff", "#ffc93c", "#ff6b57", "#2fd09a", "#8b7cff"];

// A short burst when the bank confirms a payment. Purely decorative.
export function Confetti() {
  const bits = Array.from({ length: 28 }, (_, i) => ({
    x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
    r: (i * 47) % 360,
    c: COLORS[i % COLORS.length],
    d: 0.1 + (i % 7) * 0.05,
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden motion-reduce:hidden">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0 left-1/2 h-3 w-2 rounded-sm"
          style={{ background: b.c }}
          initial={{ x: 0, y: -10, rotate: 0, opacity: 1 }}
          animate={{ x: b.x * 260, y: 180 + Math.abs(b.x) * 90, rotate: b.r + 360, opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut", delay: b.d }}
        />
      ))}
    </div>
  );
}
