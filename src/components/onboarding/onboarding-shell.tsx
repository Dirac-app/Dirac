"use client";

import { motion, AnimatePresence, type Transition } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VisualPlaceholder } from "./visual-placeholder";
import { ShaderAnimation } from "@/components/ui/shader-lines";

export type PanelPosition = "left" | "right" | "center" | "full";

export interface ScreenConfig {
  panel: PanelPosition;
  visualSlot?: string;
  visualLabel?: string;
  immersive?: boolean;
}

const PANEL_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 0.9,
};

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
  step: number;
  totalSteps: number;
  config: ScreenConfig;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  hideBack?: boolean;
  hideNext?: boolean;
  nextLabel?: string;
  nextEnabled?: boolean;
  onBack: () => void;
  onNext: () => void;
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
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="absolute inset-0 opacity-90">
        <ShaderAnimation />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

      {onSkip && !config.immersive && (
        <button
          type="button"
          onClick={onSkip}
          className="absolute right-6 top-6 z-30 text-xs text-white/40 transition-colors hover:text-white/80"
        >
          Skip setup
        </button>
      )}

      <AnimatePresence>
        {visuals.left && config.visualSlot && (
          <motion.div
            key={`vis-left-${config.visualSlot}`}
            className="pointer-events-none absolute"
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
            className="pointer-events-none absolute"
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

      <motion.div
        layout
        layoutId="onboarding-panel"
        className="absolute"
        style={panelStyle(config.panel)}
        transition={PANEL_TRANSITION}
      >
        <motion.div
          className={cn(
            "dark relative flex h-full w-full flex-col overflow-hidden rounded-2xl",
            "border border-white/10",
            "bg-black/85 backdrop-blur-xl",
          )}
        >
          {(eyebrow || title) && (
            <div className="px-8 pt-8 pb-2">
              {eyebrow && (
                <motion.p
                  key={`eyebrow-${step}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/50"
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
                  className="text-[28px] leading-[1.15] font-semibold tracking-tight text-white"
                >
                  {title}
                </motion.h1>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-8 py-4 text-white/90">
            <AnimatePresence mode="wait">
              <motion.div
                key={`body-${step}`}
                className="h-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, delay: 0.18 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {!config.immersive && (
            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-8 py-5">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-all duration-500",
                      i + 1 < step && "w-3 bg-white/40",
                      i + 1 === step && "w-6 bg-white",
                      i + 1 > step && "w-3 bg-white/15",
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
                    className="h-9 gap-1.5 px-3 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                )}
                {!hideNext && (
                  <Button
                    onClick={onNext}
                    disabled={!nextEnabled}
                    className="h-9 gap-1.5 px-5 text-sm bg-white text-black hover:bg-white/90 disabled:opacity-40"
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
