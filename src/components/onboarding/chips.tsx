"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Chip primitives ────────────────────────────────────────────
//
// Most onboarding screens are "pick from a few options." Rather than re-write
// the same hover/selected state per screen, we centralize the chip + chip-group
// here. Two flavors:
//
//   • Chip          — single tappable pill
//   • ExampleChip   — large card with a title + example body (used for tone)
//
// All chips:
//   - Show selected state with a primary border + faint primary fill
//   - Animate scale on tap for tactile feedback
//   - Are keyboard-focusable

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  description?: string;
  className?: string;
}

export function Chip({ label, selected, onClick, description, className }: ChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
        selected
          ? "border-foreground bg-foreground/5 text-foreground shadow-sm"
          : "border-border/60 bg-background/40 text-foreground/80 hover:border-foreground/40 hover:bg-background/70",
        className,
      )}
    >
      {selected && (
        <motion.span
          layoutId={`chip-check-${label}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </motion.span>
      )}
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </motion.button>
  );
}

interface ChipGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function ChipGroup({ children, className }: ChipGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}

// ─── Example chip — for tone & "card" choices ─────────────────

interface ExampleChipProps {
  title: string;
  example: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function ExampleChip({ title, example, selected, onClick, icon }: ExampleChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-2xl border px-5 py-4 text-left transition-all",
        selected
          ? "border-foreground bg-foreground/[0.04] shadow-md"
          : "border-border/50 bg-background/40 hover:border-foreground/30 hover:bg-background/60",
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            selected
              ? "bg-foreground text-background"
              : "bg-foreground/5 text-foreground/60 group-hover:bg-foreground/10",
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {selected && (
              <motion.span
                layoutId={`example-check-${title}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </motion.span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground italic">
            "{example}"
          </p>
        </div>
      </div>
    </motion.button>
  );
}
