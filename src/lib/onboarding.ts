"use client";

// ─── Onboarding state & persistence ─────────────────────────────────────────
//
// Every answer the user gives during onboarding is captured here and persisted
// to localStorage. The flow itself is driven by these values: what they pick
// on early screens shapes copy & defaults on later ones, and on completion
// every value is fanned out to the rest of the app (tone profile, AI preset,
// morning brief settings, etc.).
//
// Single source of truth for keys keeps the rest of the app honest — anywhere
// that reads "did they finish onboarding?" should import COMPLETE_KEY from
// here, never re-spell the string.

export const ONBOARDING_COMPLETE_KEY = "dirac_onboarding_complete";
export const ONBOARDING_PROGRESS_KEY = "dirac_onboarding_progress";

// ─── Question answers ──────────────────────────────────────────

export type SoftPersona = "founder" | "developer" | "consultant";

export type EmailProblem =
  | "too_much_volume"
  | "miss_important"
  | "slow_replies"
  | "no_followups";

export type ToneStyle = "direct" | "professional" | "warm";

export type Role =
  | "founder"
  | "engineer"
  | "pm"
  | "consultant"
  | "investor"
  | "other";

export type EmailVolume = "lt20" | "20_50" | "50_100" | "gt100";

export type EmailUseCase =
  | "customer_sales"
  | "internal_team"
  | "investor_partner"
  | "newsletter_receipt"
  | "personal";

export interface OnboardingAnswers {
  // Phase 2
  softPersona: SoftPersona | null;

  // Phase 3
  problems: EmailProblem[]; // up to 2
  tone: ToneStyle | null;
  role: Role | null;
  volume: EmailVolume | null;
  useCases: EmailUseCase[];

  // Phase 5
  enableMorningNotification: boolean;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  softPersona: null,
  problems: [],
  tone: null,
  role: null,
  volume: null,
  useCases: [],
  enableMorningNotification: true,
};

// ─── Progress shape (what we persist between sessions) ──────────

export interface OnboardingProgress {
  step: number; // 0-indexed screen
  answers: OnboardingAnswers;
}

const EMPTY_PROGRESS: OnboardingProgress = {
  step: 0,
  answers: EMPTY_ANSWERS,
};

// ─── Storage helpers ────────────────────────────────────────────

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true; // assume complete on SSR — never gate render
  try {
    return window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingComplete() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    // Wipe in-progress draft now that we're done
    window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  } catch {}
}

export function resetOnboarding() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  } catch {}
}

export function loadProgress(): OnboardingProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      answers: { ...EMPTY_ANSWERS, ...(parsed.answers ?? {}) },
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: OnboardingProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

// ─── On completion: fan out answers to the rest of the app ──────
//
// Translates onboarding choices into the keys/state shapes the rest of the
// app already reads. We don't reach into React state directly here — instead
// we write to localStorage and dispatch the same change events that the
// settings page does, so listeners (sender-overrides pattern) pick it up.

const TONE_PROFILE_KEY = "dirac-tone-profile";
const MORNING_BRIEF_SETTINGS_KEY = "dirac_morning_brief_settings";

interface PersistedTone {
  summary: string;
  formality: "formal" | "semi-formal" | "casual" | "very-casual";
  traits: string[];
  greeting_style: string;
  signoff_style: string;
  example_phrases: string[];
}

const TONE_TEMPLATES: Record<ToneStyle, PersistedTone> = {
  direct: {
    summary: "Concise, no fluff. Says what needs to be said and stops.",
    formality: "casual",
    traits: ["concise", "action-oriented", "no-preamble"],
    greeting_style: "Hey {name},",
    signoff_style: "Thanks,",
    example_phrases: [
      "Got it — let's go with Tuesday.",
      "Quick one — can you confirm by EOD?",
      "Done. Anything else?",
    ],
  },
  professional: {
    summary: "Polished, structured, business-appropriate. Friendly but measured.",
    formality: "semi-formal",
    traits: ["clear", "structured", "polite"],
    greeting_style: "Hi {name},",
    signoff_style: "Best regards,",
    example_phrases: [
      "Thank you for reaching out — happy to help here.",
      "Following up on the points below — let me know your thoughts.",
      "Appreciate the context. Here's what I'd suggest:",
    ],
  },
  warm: {
    summary: "Friendly, energetic, personable. Treats every email like a chat.",
    formality: "casual",
    traits: ["enthusiastic", "personable", "encouraging"],
    greeting_style: "Hey {name}!",
    signoff_style: "Cheers,",
    example_phrases: [
      "Hey! This sounds amazing — let's make it happen.",
      "Love this idea — let me think about it and circle back today.",
      "Totally understand! No worries at all.",
    ],
  },
};

interface MorningBriefSettings {
  hour: number;
  enabled: boolean;
  weekdaysOnly: boolean;
  morningOnly: boolean;
  maxItems: number;
  notification: boolean;
}

export function applyAnswers(answers: OnboardingAnswers) {
  if (typeof window === "undefined") return;

  // Tone profile → wired into AppProvider on next read & ai-sidebar context
  if (answers.tone) {
    try {
      const tone = TONE_TEMPLATES[answers.tone];
      window.localStorage.setItem(TONE_PROFILE_KEY, JSON.stringify(tone));
    } catch {}
  }

  // AI preset — pick a sensible default keyed off persona + volume.
  // High-volume users get the fast preset; everyone else gets balanced.
  try {
    const preset =
      answers.volume === "gt100" || answers.volume === "50_100"
        ? "fast"
        : "balanced";
    window.localStorage.setItem("dirac-ai-preset", preset);
  } catch {}

  // Morning brief settings — default 8am, opt-in browser notification.
  try {
    const existingRaw = window.localStorage.getItem(MORNING_BRIEF_SETTINGS_KEY);
    const existing: Partial<MorningBriefSettings> = existingRaw
      ? JSON.parse(existingRaw)
      : {};
    const next: MorningBriefSettings = {
      hour: 8,
      enabled: true,
      weekdaysOnly: false,
      morningOnly: true,
      maxItems: 5,
      ...existing,
      notification: answers.enableMorningNotification,
    };
    window.localStorage.setItem(MORNING_BRIEF_SETTINGS_KEY, JSON.stringify(next));
  } catch {}

  // Persist the raw answers for analytics / future re-personalization
  try {
    window.localStorage.setItem(
      "dirac_onboarding_answers",
      JSON.stringify(answers),
    );
  } catch {}
}
