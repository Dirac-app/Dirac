"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Keyboard, MessageSquare, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "Your AI-first inbox",
    description: "Gmail, Outlook, and Discord — all in one place. AI triages, summarizes, and helps you respond.",
    icon: <Sparkles className="h-6 w-6 text-primary" />,
  },
  {
    id: 2,
    title: "Keyboard at speed of thought",
    description: "Press J/K to navigate, E to archive, R to reply. Or hit Cmd+K for instant search.",
    icon: <Keyboard className="h-6 w-6 text-primary" />,
  },
  {
    id: 3,
    title: "AI that knows your voice",
    description: "Dirac learns your writing style. Every draft matches your tone — no more generic responses.",
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
  },
];

const ONBOARDING_KEY = "dirac_onboarding_seen";

interface OnboardingModalProps {
  onComplete?: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setIsOpen(false);
    onComplete?.();
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setIsOpen(false);
    onComplete?.();
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md mx-4 overflow-hidden rounded-2xl bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative p-6 pb-4">
            <button
              onClick={handleSkip}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              {step.icon}
            </div>

            <h2 className="mb-2 text-xl font-semibold text-foreground">{step.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>

          <div className="flex items-center gap-3 border-t border-border px-6 py-4">
            <div className="flex flex-1 items-center gap-2">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    idx <= currentStep ? "bg-primary" : "bg-muted",
                    idx === currentStep ? "w-8" : "w-4",
                  )}
                />
              ))}
            </div>

            <Button onClick={handleNext} size="sm" className="gap-2">
              {currentStep === STEPS.length - 1 ? "Get started" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-center pb-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-border"
              />
              Don't show this again
            </label>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}