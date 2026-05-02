"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Visual Placeholder ─────────────────────────────────────────
//
// Soft, ambient stand-in for the onboarding "visual half." When the user
// supplies real visual assets (loops, glassmorphism canvases, fluid sims),
// we'll swap the inner content per `slot` id and keep this shell + animation
// intact. Until then, every visual half renders this with a unique slot id
// so the future swap is mechanical.
//
// Each slot id picks a different gradient/orb arrangement so adjacent
// screens don't look identical during the match-cut. Variety here is what
// sells the cinematography even without final assets.

const SLOT_GRADIENTS: Record<string, string> = {
  "phase-1": "from-indigo-200/40 via-rose-100/30 to-amber-100/40",
  "phase-2": "from-sky-200/40 via-violet-100/30 to-pink-100/40",
  "phase-3": "from-emerald-100/40 via-teal-100/30 to-cyan-100/40",
  "phase-4": "from-amber-100/50 via-rose-100/40 to-fuchsia-100/40",
  "phase-5": "from-violet-200/40 via-indigo-100/30 to-sky-100/40",
};

const DARK_SLOT_GRADIENTS: Record<string, string> = {
  "phase-1": "dark:from-indigo-950/40 dark:via-rose-950/30 dark:to-amber-950/40",
  "phase-2": "dark:from-sky-950/40 dark:via-violet-950/30 dark:to-pink-950/40",
  "phase-3": "dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40",
  "phase-4": "dark:from-amber-950/40 dark:via-rose-950/30 dark:to-fuchsia-950/40",
  "phase-5": "dark:from-violet-950/40 dark:via-indigo-950/30 dark:to-sky-950/40",
};

const ORB_COLORS: Record<string, string[]> = {
  "phase-1": ["bg-indigo-400/30", "bg-rose-300/30", "bg-amber-300/25"],
  "phase-2": ["bg-sky-400/30", "bg-violet-300/30", "bg-pink-300/25"],
  "phase-3": ["bg-emerald-400/30", "bg-teal-300/30", "bg-cyan-300/25"],
  "phase-4": ["bg-amber-400/35", "bg-rose-400/30", "bg-fuchsia-400/25"],
  "phase-5": ["bg-violet-400/30", "bg-indigo-300/30", "bg-sky-300/25"],
};

export function VisualPlaceholder({
  slot,
  className,
  label,
}: {
  slot: string;
  className?: string;
  label?: string;
}) {
  const gradient = SLOT_GRADIENTS[slot] ?? SLOT_GRADIENTS["phase-1"];
  const darkGradient = DARK_SLOT_GRADIENTS[slot] ?? DARK_SLOT_GRADIENTS["phase-1"];
  const orbs = ORB_COLORS[slot] ?? ORB_COLORS["phase-1"];

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl",
        "bg-gradient-to-br",
        gradient,
        darkGradient,
        className,
      )}
    >
      {/* Soft drifting orbs — substitute fluid/glass effect later */}
      {orbs.map((orb, i) => (
        <motion.div
          key={`${slot}-orb-${i}`}
          className={cn(
            "absolute rounded-full blur-3xl",
            orb,
          )}
          style={{
            width: 320 - i * 60,
            height: 320 - i * 60,
            top: `${15 + i * 25}%`,
            left: `${20 + i * 18}%`,
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -25, 15, 0],
            scale: [1, 1.05, 0.97, 1],
          }}
          transition={{
            duration: 18 + i * 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 2,
          }}
        />
      ))}

      {/* Subtle "future asset goes here" hint — only visible with low opacity */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-6">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/15">
          {label ?? `visual · ${slot}`}
        </span>
      </div>
    </div>
  );
}
