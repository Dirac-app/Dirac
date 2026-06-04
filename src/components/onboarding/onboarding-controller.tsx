"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

interface StepRow {
  Component: React.FC<S.ScreenProps>;
  config: ScreenConfig;
  eyebrow?: string;
  title?: string;
  hideNext?: boolean;
  canAdvance?: (a: OnboardingAnswers) => boolean;
  nextLabel?: string;
}

const STEPS: StepRow[] = [
  {
    Component: S.Screen1Pitch,
    config: { panel: "full" },
    nextLabel: "Get started",
  },
  {
    Component: S.Screen2Video,
    config: { panel: "right", visualSlot: "slot-welcome" },
    eyebrow: "Welcome",
    title: "See it in 45 seconds",
  },
  {
    Component: S.Screen3Persona,
    config: { panel: "left", visualSlot: "slot-persona" },
    eyebrow: "Step 1 of 3",
    title: "Who are you?",
    canAdvance: (a) => a.softPersona !== null,
  },
  {
    Component: S.Screen4SignIn,
    config: { panel: "right", visualSlot: "slot-connect" },
    eyebrow: "Account",
    title: "Connect Gmail",
    hideNext: true,
  },
  {
    Component: S.Screen6Problem,
    config: { panel: "left", visualSlot: "slot-problems" },
    eyebrow: "Step 2 of 3",
    title: "What's slowing you down?",
    canAdvance: (a) => a.problems.length > 0,
  },
  {
    Component: S.Screen7Tone,
    config: { panel: "right", visualSlot: "slot-tone" },
    eyebrow: "Step 3 of 3",
    title: "How do you write?",
    canAdvance: (a) => a.tone !== null,
  },
  {
    Component: S.Screen8DeepPersona,
    config: { panel: "left", visualSlot: "slot-deep" },
    eyebrow: "Almost there",
    title: "About your work",
    canAdvance: (a) => a.role !== null && a.volume !== null,
  },
  {
    Component: S.Screen9Syncing,
    config: { panel: "full" },
    eyebrow: "Loading",
    title: "Reading your inbox",
    hideNext: true,
  },
  {
    Component: S.Screen10MorningBrief,
    config: { panel: "right", visualSlot: "slot-morning" },
    eyebrow: "What you'll see every morning",
    title: "Your morning brief",
  },
  {
    Component: S.Screen11AcceptPlan,
    config: { panel: "right", visualSlot: "slot-morning" },
    eyebrow: "Try it now",
    title: "Watch the AI take over",
    hideNext: true,
  },
  {
    Component: S.Screen12Notification,
    config: { panel: "left", visualSlot: "slot-notify" },
    eyebrow: "Habit",
    title: "Show up every morning",
  },
  {
    Component: S.Screen13Privacy,
    config: { panel: "right", visualSlot: "slot-privacy" },
    eyebrow: "Privacy",
    title: "Your inbox is yours",
  },
  {
    Component: S.Screen14Summary,
    config: { panel: "full" },
    eyebrow: "Setup complete",
    title: "You're set",
  },
  {
    Component: S.Screen15Enter,
    config: { panel: "full", immersive: true },
    hideNext: true,
  },
];

interface OnboardingControllerProps {
  forceOpen?: boolean;
  onComplete?: () => void;
}

export function OnboardingController({
  forceOpen = false,
  onComplete,
}: OnboardingControllerProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const progress = loadProgress();
    setStep(progress.step);
    setAnswers(progress.answers);

    if (!isOnboardingComplete()) {
      setOpen(true);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) saveProgress({ step, answers });
  }, [step, answers, open]);

  const patch = useCallback((p: Partial<OnboardingAnswers>) => {
    setAnswers((a) => ({ ...a, ...p }));
  }, []);

  const handleNext = useCallback(() => {
    const row = STEPS[step];
    const canAdvanceNow = row.canAdvance ? row.canAdvance(answers) : true;
    if (!canAdvanceNow) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, [step, answers]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleComplete = useCallback(() => {
    applyAnswers(answers);
    markOnboardingComplete();
    setOpen(false);
    onComplete?.();
  }, [answers, onComplete]);

  const handleSkip = useCallback(() => {
    const ok = window.confirm(
      "Skip onboarding? You can re-run it from Settings.",
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
