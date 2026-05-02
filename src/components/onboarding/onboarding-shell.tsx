"use client";

import { motion, AnimatePresence, type Transition } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VisualPlaceholder } from "./visual-placeholder";

// ─── Onboarding Shell ───────────────────────────────────────────
//
// The shell is the canvas every screen renders into. It owns:
//   1. The match-cut motion of the question panel between L/R/center/full.
//   2. The visual half (placeholder or real asset) that crossfades.
//   3. The footer (back / next, progress dots).
//
// Each screen passes a `panel` position and a `visualSlot` id; the shell
// handles all motion. Children components stay declarative — no motion logic
// leaks into the per-screen files.
//
// The trick that makes this feel like a match cut is the shared `layoutId`
// on the panel container. Framer animates the panel's geometry across
// screens as if it's the same physical element, so the "card" appears to
// glide rather than swap.

export type PanelPosition = "left" | "right" | "center" | "full";

export interface ScreenConfig {
  panel: PanelPosition;
  visualSlot?: string; // id picked by VisualPlaceholder; omit when panel is full
  visualLabel?: string;
  /** When set, the screen wants no chrome (no nav, no progress) — e.g. a finale */
  immersive?: boolean;
}

const PANEL_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 0.9,
};

// Width/positioning of the panel container, per layout. We animate the
// container's geometry; the inner card just stretches to fill.
function panelStyle(position: PanelPosition): React.CSSProperties {
  switch (position) {
    case "left":
      return { left: "5%", right: "55%", top: "10%", bottom: "10%" };
    case "right":
      return { left: "55%", right: "5%", top: "10%", bottom: "10%" };
    case "center":
      return { left: "30%", right: "30%", top: "12%", bottom: "12%" };
    case "full":
      return { left: "10%", right: "10%", top: "8%", bottom: "8%" };
  }
}

function visualStyle(position: PanelPosition): {
  left: React.CSSProperties | null;
  right: React.CSSProperties | null;
} {
  // Panel position determines which half is "free" for visuals. When the
  // panel is full or center, both visuals fade out.
  switch (position) {
    case "left":
      return { left: null, right: { left: "55%", right: "5%", top: "10%", bottom: "10%" } };
    case "right":
      return { left: { left: "5%", right: "55%", top: "10%", bottom: "10%" }, right: null };
    case "center":
      return {
        left: { left: "5%", right: "72%", top: "12%", bottom: "12%" },
        right: { left: "72%", right: "5%", top: "12%", bottom: "12%" },
      };
    case "full":
      return { left: null, right: null };
  }
}

interface OnboardingShellProps {
  /** 1-indexed for human-friendly progress display */
  step: number;
  totalSteps: number;
  config: ScreenConfig;
  /** Title shown in the panel — kept here so we can animate it consistently */
  title?: string;
  /** Optional sub-eyebrow above the title (phase label) */
  eyebrow?: string;
  /** Panel body content */
  children: React.ReactNode;
  /** When true, hides the global back button (e.g. first screen) */
  hideBack?: boolean;
  /** When true, hides the next button (e.g. screens with their own continue logic) */
  hideNext?: boolean;
  /** Override next button label */
  nextLabel?: string;
  /** When false, next is disabled (e.g. required choice not made) */
  nextEnabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Skip handler — appears in the top-right corner */
  onSkip?: () => void;
}

export function OnboardingShell({
  step,
  totalSteps,
  config,
  title,
  eyebrow,
  children,
  hideBack = false,
  hideNext = false,
  nextLabel = "Next",
  nextEnabled = true,
  onBack,
  onNext,
  onSkip,
}: OnboardingShellProps) {
  const visuals = visualStyle(config.panel);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop — uses dirac-bg gradient so it feels like part of the app */}
      <div className="dirac-bg absolute inset-0" />

      {/* Skip — always available, top right, low-key */}
      {onSkip && !config.immersive && (
        <button
          onClick={onSkip}
          className="absolute right-6 top-6 z-30 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          Skip setup
        </button>
      )}

      {/* Visual halves — crossfade as the slot changes */}
      <AnimatePresence>
        {visuals.left && config.visualSlot && (
          <motion.div
            key={`vis-left-${config.visualSlot}`}
            className="absolute pointer-events-none"
            style={visuals.left}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <VisualPlaceholder slot={config.visualSlot} label={config.visualLabel} />
          </motion.div>
        )}
        {visuals.right && config.visualSlot && (
          <motion.div
            key={`vis-right-${config.visualSlot}`}
            className="absolute pointer-events-none"
            style={visuals.right}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <VisualPlaceholder slot={config.visualSlot} label={config.visualLabel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The panel — match-cut motion via layoutId */}
      <motion.div
        layout
        layoutId="onboarding-panel"
        className="absolute"
        style={panelStyle(config.panel)}
        transition={PANEL_TRANSITION}
      >
        <motion.div
          className={cn(
            "dirac-panel relative flex h-full w-full flex-col overflow-hidden",
            "border border-border/40",
          )}
        >
          {/* Panel header — eyebrow + title */}
          {(eyebrow || title) && (
            <div className="px-8 pt-8 pb-2">
              {eyebrow && (
                <motion.p
                  key={`eyebrow-${step}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70"
                >
                  {eyebrow}
                </motion.p>
              )}
              {title && (
                <motion.h1
                  key={`title-${step}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="text-[28px] leading-[1.15] font-semibold tracking-tight text-foreground"
                >
                  {title}
                </motion.h1>
              )}
            </div>
          )}

          {/* Panel body — fades on step change */}
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`body-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, delay: 0.18 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — progress dots + back/next */}
          {!config.immersive && (
            <div className="flex items-center justify-between gap-4 border-t border-border/40 px-8 py-5">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-all duration-500",
                      i + 1 < step && "w-3 bg-foreground/40",
                      i + 1 === step && "w-6 bg-foreground",
                      i + 1 > step && "w-3 bg-foreground/15",
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!hideBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-9 gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                )}
                {!hideNext && (
                  <Button
                    onClick={onNext}
                    disabled={!nextEnabled}
                    className="h-9 gap-1.5 px-5 text-sm"
                  >
                    {nextLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
