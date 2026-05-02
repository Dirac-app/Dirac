"use client";

import { useState, useEffect, useCallback } from "react";
import { OnboardingShell, type ScreenConfig } from "./onboarding-shell";
import * as S from "./screens";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  loadProgress,
  saveProgress,
  applyAnswers,
  EMPTY_ANSWERS,
  type OnboardingAnswers,
} from "@/lib/onboarding";

// ─── Onboarding Controller ──────────────────────────────────────
//
// Owns the step index, the shared answer object, and the per-screen config
// (panel position + visual slot). Each step row is a single source of truth
// for: which component to render, where the panel sits, what eyebrow / title
// to show in the shell, and any chrome overrides.
//
// The shell handles motion. The controller handles state. The screens just
// render UI.
//
// Persistence: the user can close the tab mid-onboarding and resume on
// reload because we save (step, answers) to localStorage on every change.

interface StepRow {
  Component: React.FC<S.ScreenProps>;
  config: ScreenConfig;
  eyebrow?: string;
  title?: string;
  /** Some screens (sign-in, sync, accept-plan, finale) drive their own
   *  advancement and want the Next button hidden. */
  hideNext?: boolean;
  /** Predicate returning whether the user is allowed to advance. Defaults to true. */
  canAdvance?: (a: OnboardingAnswers) => boolean;
  nextLabel?: string;
}

const STEPS: StepRow[] = [
  // PHASE 1 — HOOK
  {
    Component: S.Screen1Pitch,
    config: { panel: "full", visualSlot: "phase-1" },
    nextLabel: "Get started",
  },
  {
    Component: S.Screen2Video,
    config: { panel: "right", visualSlot: "phase-1" },
    eyebrow: "Welcome",
    title: "See it in 45 seconds",
  },

  // PHASE 2 — SIGNUP
  {
    Component: S.Screen3Persona,
    config: { panel: "left", visualSlot: "phase-2" },
    eyebrow: "Step 1 of 3",
    title: "Who are you?",
    canAdvance: (a) => a.softPersona !== null,
  },
  {
    Component: S.Screen4SignIn,
    config: { panel: "center", visualSlot: "phase-2" },
    eyebrow: "Sign in",
    title: "Create your account",
    hideNext: true,
  },
  {
    Component: S.Screen5ConnectInbox,
    config: { panel: "right", visualSlot: "phase-2" },
    eyebrow: "Permissions",
    title: "Connect your inbox",
    hideNext: true,
  },

  // PHASE 3 — PERSONALIZE
  {
    Component: S.Screen6Problem,
    config: { panel: "left", visualSlot: "phase-3" },
    eyebrow: "Step 2 of 3",
    title: "What's slowing you down?",
    canAdvance: (a) => a.problems.length > 0,
  },
  {
    Component: S.Screen7Tone,
    config: { panel: "right", visualSlot: "phase-3" },
    eyebrow: "Step 3 of 3",
    title: "How do you write?",
    canAdvance: (a) => a.tone !== null,
  },
  {
    Component: S.Screen8DeepPersona,
    config: { panel: "left", visualSlot: "phase-3" },
    eyebrow: "Almost there",
    title: "About your work",
    canAdvance: (a) => a.role !== null && a.volume !== null,
  },

  // PHASE 4 — AHA
  {
    Component: S.Screen9Syncing,
    config: { panel: "full", visualSlot: "phase-4" },
    eyebrow: "Loading",
    title: "Reading your inbox",
    hideNext: true,
  },
  {
    Component: S.Screen10MorningBrief,
    config: { panel: "right", visualSlot: "phase-4" },
    eyebrow: "What you'll see every morning",
    title: "Your morning brief",
  },
  {
    Component: S.Screen11AcceptPlan,
    config: { panel: "right", visualSlot: "phase-4" },
    eyebrow: "Try it now",
    title: "Watch the AI take over",
    hideNext: true,
  },

  // PHASE 5 — HABIT + DONE
  {
    Component: S.Screen12Notification,
    config: { panel: "left", visualSlot: "phase-5" },
    eyebrow: "Habit",
    title: "Show up every morning",
  },
  {
    Component: S.Screen13Privacy,
    config: { panel: "right", visualSlot: "phase-5" },
    eyebrow: "Privacy",
    title: "Your inbox is yours",
  },
  {
    Component: S.Screen14Summary,
    config: { panel: "center", visualSlot: "phase-5" },
    eyebrow: "Setup complete",
    title: "You're set",
  },
  {
    Component: S.Screen15Enter,
    config: { panel: "full", visualSlot: "phase-5" },
    hideNext: true,
  },
];

interface OnboardingControllerProps {
  onComplete?: () => void;
}

export function OnboardingController({ onComplete }: OnboardingControllerProps) {
  // Mount-gate: render nothing until we've checked localStorage. Avoids the
  // brief flash of onboarding for returning users on slow first paint.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  useEffect(() => {
    setMounted(true);
    if (!isOnboardingComplete()) {
      const progress = loadProgress();
      setStep(progress.step);
      setAnswers(progress.answers);
      setOpen(true);
    }
  }, []);

  // Persist on every change — cheap, no debounce needed.
  useEffect(() => {
    if (open) saveProgress({ step, answers });
  }, [step, answers, open]);

  const patch = useCallback((p: Partial<OnboardingAnswers>) => {
    setAnswers((a) => ({ ...a, ...p }));
  }, []);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, []);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleComplete = useCallback(() => {
    applyAnswers(answers);
    markOnboardingComplete();
    setOpen(false);
    onComplete?.();
  }, [answers, onComplete]);

  // Skip = same as complete, but with whatever defaults were already chosen.
  // Two-click protection (confirm dialog) is intentional: skipping should
  // feel deliberate, not accidental.
  const handleSkip = useCallback(() => {
    const ok = window.confirm(
      "Skip onboarding? You can always re-run it from Settings.",
    );
    if (!ok) return;
    applyAnswers(answers);
    markOnboardingComplete();
    setOpen(false);
    onComplete?.();
  }, [answers, onComplete]);

  if (!mounted || !open) return null;

  const isLast = step === STEPS.length - 1;
  const row = STEPS[step];
  const ScreenComponent = row.Component;
  const canAdvance = row.canAdvance ? row.canAdvance(answers) : true;

  // The very last screen's "Continue" maps to handleComplete instead of next.
  // Same treatment for the immersive finale's primary buttons.
  const goNext = isLast ? handleComplete : handleNext;

  return (
    <OnboardingShell
      step={step + 1}
      totalSteps={STEPS.length}
      config={row.config}
      eyebrow={row.eyebrow}
      title={row.title}
      hideBack={step === 0}
      hideNext={row.hideNext}
      nextEnabled={canAdvance}
      nextLabel={isLast ? "Enter Dirac" : row.nextLabel ?? "Next"}
      onBack={handleBack}
      onNext={goNext}
      onSkip={handleSkip}
    >
      <ScreenComponent answers={answers} onPatch={patch} goNext={goNext} />
    </OnboardingShell>
  );
}
