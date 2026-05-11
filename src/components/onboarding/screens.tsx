"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import {
  Mail,
  Inbox,
  Sparkles,
  Zap,
  Shield,
  Bell,
  CheckCircle2,
  Play,
  Briefcase,
  Code2,
  Users,
  Loader2,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Building2,
  TrendingUp,
  PieChart,
  User,
  Target,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup, ExampleChip } from "./chips";
import { cn } from "@/lib/utils";
import type {
  OnboardingAnswers,
  SoftPersona,
  EmailProblem,
  ToneStyle,
  Role,
  EmailVolume,
  EmailUseCase,
} from "@/lib/onboarding";
import type { DiracThread } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Demo-thread utilities
// Picks the most compelling real inbox thread for the morning-brief demo
// (Screens 10 & 11). Falls back to synthetic data if the inbox is empty
// or contains only newsletters / automated mail.
// ─────────────────────────────────────────────────────────────────────────────

const NOISE_SUBJECT_PATTERNS = [
  "unsubscribe", "newsletter", "weekly digest", "monthly digest",
  "digest", "notification", "alert", "noreply", "no-reply",
  "automated", "do not reply", "donotreply", "your account",
  "verify", "confirm your", "password reset", "receipt",
];
const NOISE_SENDER_PREFIXES = [
  "noreply", "no-reply", "notifications", "newsletter", "mailer",
  "donotreply", "do-not-reply", "support+", "alert",
];

function isNoise(thread: DiracThread): boolean {
  const sub = thread.subject.toLowerCase();
  if (NOISE_SUBJECT_PATTERNS.some((p) => sub.includes(p))) return true;
  const sender = (thread.participants[0]?.email ?? "").toLowerCase();
  if (NOISE_SENDER_PREFIXES.some((p) => sender.startsWith(p))) return true;
  return false;
}

function scoreThread(thread: DiracThread): number {
  if (isNoise(thread)) return -100;
  let s = 0;
  if (thread.isUnread) s += 10;
  if (thread.isUrgent) s += 8;
  if (thread.isStarred) s += 5;
  if (thread.messageCount >= 2) s += 4;
  if (thread.messageCount >= 4) s += 2;
  if (thread.status === "DONE") s -= 6;
  const len = thread.subject.length;
  if (len >= 10 && len <= 80) s += 3;
  return s;
}

export function pickBestDemoThread(threads: DiracThread[]): DiracThread | null {
  const ranked = [...threads]
    .map((t) => ({ t, score: scoreThread(t) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.t ?? null;
}

type DemoData = {
  cardSubject: string;
  cardFrom: string;
  cardPlan: string;
  draftText: string;
  adjustOptions: { label: string; draft: string }[];
};

const FALLBACK_DEMO: DemoData = {
  cardSubject: "Q2 board update — needs your eyes",
  cardFrom: "lisa@acme.vc",
  cardPlan: "Lisa is asking for the Q2 update by Friday. Reply with status and one open question.",
  draftText: "Hi Lisa — here's the Q2 update. Revenue tracked +18% MoM, two key hires landed, and the Series A conversations are progressing. Open question: should we accelerate the security audit ahead of the round?\n\n— ",
  adjustOptions: [
    {
      label: "Cool, let's meet Tuesday at 10am! ☕",
      draft: "Hi Lisa — Q2 is looking strong. Revenue +18% MoM, two key hires landed. Tuesday at 10am works great for a quick sync — does that suit you?\n\n— ",
    },
    {
      label: "Wednesday works better for me",
      draft: "Hi Lisa — here's the Q2 update. Revenue +18% MoM, two hires in. One open question on the audit timing. Wednesday afternoon better for a call?\n\n— ",
    },
    {
      label: "I'm gonna have to pass — too busy right now",
      draft: "Hi Lisa — the Q2 numbers are solid (+18% MoM, two key hires). I'm packed this week. Can we push to early next week instead?\n\n— ",
    },
  ],
};

function buildDemoFromThread(thread: DiracThread): DemoData {
  const sender = thread.participants[0];
  const firstName =
    sender?.name?.split(" ")[0] ??
    sender?.email?.split("@")[0] ??
    "there";
  const senderShort = sender?.email ?? firstName;
  const subjectShort =
    thread.subject.length > 55
      ? thread.subject.slice(0, 52) + "…"
      : thread.subject;

  const sub = thread.subject.toLowerCase();
  const snip = (thread.snippet ?? "").toLowerCase();

  // Detect intent from subject / snippet keywords
  const isMeeting = /\b(meet|meeting|sync|call|catch[- ]up|coffee|lunch|chat|schedule|zoom|calendar)\b/.test(sub + " " + snip);
  const isQuestion = /[?]|follow[- ]?up|question|request|wondering|thought|asking/.test(sub + " " + snip);

  const cardPlan = `${firstName} sent "${subjectShort}". Dirac flagged it as worth your time — here's the suggested reply.`;

  if (isMeeting) {
    return {
      cardSubject: thread.subject,
      cardFrom: senderShort,
      cardPlan,
      draftText: `Hi ${firstName} — thanks for the ping on "${subjectShort}". Happy to find a time. Let me know your availability and I'll lock something in.\n\n— `,
      adjustOptions: [
        {
          label: "Cool, Tuesday at 10am works! ☕",
          draft: `Hi ${firstName} — Tuesday at 10am works for me. Sending a calendar invite now.\n\n— `,
        },
        {
          label: "Wednesday is better for me",
          draft: `Hi ${firstName} — can we shift to Wednesday? Afternoon works best on my end.\n\n— `,
        },
        {
          label: "I'll have to pass — too packed right now",
          draft: `Hi ${firstName} — appreciate the invite. Things are pretty packed — can we revisit in two weeks?\n\n— `,
        },
      ],
    };
  }

  if (isQuestion) {
    return {
      cardSubject: thread.subject,
      cardFrom: senderShort,
      cardPlan,
      draftText: `Hi ${firstName} — good question on "${subjectShort}". Here's where I'm at:\n\n[Dirac will fill this in based on context]\n\n— `,
      adjustOptions: [
        {
          label: "Yes — happy to share more context",
          draft: `Hi ${firstName} — yes, happy to share more context on this. Let me put together a quick summary and send it over.\n\n— `,
        },
        {
          label: "Let's jump on a quick call",
          draft: `Hi ${firstName} — easier to explain on a call. Do you have 15 mins this week?\n\n— `,
        },
        {
          label: "Need a couple more days on this one",
          draft: `Hi ${firstName} — I'm still working through this. Give me a couple of days and I'll have a proper answer for you.\n\n— `,
        },
      ],
    };
  }

  // Generic
  return {
    cardSubject: thread.subject,
    cardFrom: senderShort,
    cardPlan,
    draftText: `Hi ${firstName} — following up on "${subjectShort}". I'll get back to you with a full response shortly.\n\n— `,
    adjustOptions: [
      {
        label: "On it — full reply by Friday",
        draft: `Hi ${firstName} — this is on my radar. I'll send a full reply by end of week.\n\n— `,
      },
      {
        label: "Quick question before I respond",
        draft: `Hi ${firstName} — before I reply in full: could you clarify what you need most urgently? That'll help me prioritise.\n\n— `,
      },
      {
        label: "Need a few more days",
        draft: `Hi ${firstName} — "${subjectShort}" is on my list. I need a couple more days — thanks for your patience.\n\n— `,
      },
    ],
  };
}

// Common props every screen receives. Screens read from `answers` and emit
// patches via `onPatch`. Navigation buttons live in the shell, so screens
// only need to wire up the panel body.
export interface ScreenProps {
  answers: OnboardingAnswers;
  onPatch: (patch: Partial<OnboardingAnswers>) => void;
  goNext: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 — HOOK
// ═══════════════════════════════════════════════════════════════════════════

// Screen 1 — Pitch + 20s loop
export function Screen1Pitch(_props: ScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background mb-6"
      >
        <Sparkles className="h-7 w-7" />
      </motion.div>

      <h2 className="max-w-xl text-[42px] leading-[1.05] font-semibold tracking-tight text-foreground">
        Your AI chief of staff for email.
      </h2>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Not a filter. Not a summary. Dirac reads your inbox, plans your day,
        and sends emails for you.
      </p>

      <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> Built for keyboard
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3" /> Privacy-first
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Mail className="h-3 w-3" /> Gmail · Outlook
        </span>
      </div>
    </div>
  );
}

// Screen 2 — Founder video / product walkthrough (optional)
export function Screen2Video(_props: ScreenProps) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        A 45-second look at what Dirac does — straight from the person who
        built it.
      </p>

      <button className="group mt-6 relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-colors">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg group-hover:scale-110 transition-transform">
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          </div>
        </div>
        <div className="absolute bottom-3 left-4 text-[11px] text-muted-foreground">
          Founder intro · 45s
        </div>
      </button>

      <p className="mt-4 text-[12px] text-muted-foreground/60">
        Optional. You can skip ahead any time.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — SIGNUP
// ═══════════════════════════════════════════════════════════════════════════

// Screen 3 — Soft persona
export function Screen3Persona({ answers, onPatch }: ScreenProps) {
  const PERSONAS: { id: SoftPersona; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: "founder",    label: "Founder",    sub: "Building something.",       icon: <Briefcase className="h-4 w-4" /> },
    { id: "developer",  label: "Developer",  sub: "Lives in the terminal.",    icon: <Code2 className="h-4 w-4" /> },
    { id: "consultant", label: "Consultant", sub: "Working across clients.",   icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Pick the closest match. We'll tune the experience around it.
      </p>

      <div className="mt-6 grid gap-3">
        {PERSONAS.map((p) => (
          <ExampleChip
            key={p.id}
            title={p.label}
            example={p.sub}
            selected={answers.softPersona === p.id}
            onClick={() => onPatch({ softPersona: p.id })}
            icon={p.icon}
          />
        ))}
      </div>
    </div>
  );
}

// Screen 4 — Continue with Google (auth)
//
// Auth is delegated to the existing NextAuth setup. After sign-in the page
// re-renders with a session, and we render a "you're in" confirmation that
// auto-advances. Until then, the button is the entire content.
export function Screen4SignIn({ goNext }: ScreenProps) {
  const { data: session, status } = useSession();
  const [signingIn, setSigningIn] = useState(false);

  // Once authenticated, hold for a moment so the user sees the success
  // confirmation, then auto-advance.
  useEffect(() => {
    if (session?.user?.email) {
      const t = setTimeout(() => goNext(), 900);
      return () => clearTimeout(t);
    }
  }, [session, goNext]);

  const handleSignIn = async () => {
    setSigningIn(true);
    // OAuth requires a full redirect to Google — redirect: false would
    // return the URL without navigating, so the flow never starts.
    // Onboarding progress is in localStorage so the modal resumes on return.
    await signIn("google");
    setSigningIn(false); // only reached if signIn throws before redirect
  };

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session?.user?.email) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-col items-center justify-center text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <p className="text-base font-medium text-foreground">
          Signed in as {session.user.email}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">One moment…</p>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Use your Google account. We won't post anything or contact anyone on
        your behalf.
      </p>

      <Button
        size="lg"
        onClick={handleSignIn}
        disabled={signingIn}
        className="mt-6 h-12 w-full gap-3 text-sm font-medium"
      >
        {signingIn ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <div className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground/70">
        <Lock className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Your account is private to you. Email accounts are connected on the
          next step — you can disconnect anytime.
        </span>
      </div>
    </div>
  );
}

// Screen 5 — Connect inbox (the OAuth ask)
//
// This is the single most important conversion moment. The screen earns the
// permission by showing exactly what Dirac will and won't do, side by side.
export function Screen5ConnectInbox({ goNext }: ScreenProps) {
  const { data: session } = useSession();
  const isConnected = Boolean(session?.gmailConnected);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => goNext(), 1100);
      return () => clearTimeout(t);
    }
  }, [isConnected, goNext]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    // Same as Screen4 — OAuth must redirect. Gmail scopes are already
    // included in the Google provider config, so after this redirect the
    // session will have gmailConnected: true and Screen5 auto-advances.
    await signIn("google");
    setConnecting(false);
  };

  if (isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-col items-center justify-center text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <p className="text-base font-medium text-foreground">Inbox connected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Loading your threads now…
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Dirac needs read & send access to make the morning brief and AI sidebar
        work. Here's exactly what that means.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {/* What it does */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Eye className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[11px] uppercase tracking-wider font-medium text-emerald-700 dark:text-emerald-400">What we do</p>
          </div>
          <ul className="space-y-1.5 text-[12.5px] leading-snug text-foreground/80">
            <li>Read threads to build your morning brief</li>
            <li>Draft replies in your tone</li>
            <li>Triage urgency and category</li>
            <li>Send when you click Send</li>
          </ul>
        </div>

        {/* What it never does */}
        <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">What we don't</p>
          </div>
          <ul className="space-y-1.5 text-[12.5px] leading-snug text-foreground/80">
            <li>Train any model on your email</li>
            <li>Share data with third parties</li>
            <li>Send anything without your action</li>
            <li>Store messages on our servers</li>
          </ul>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleConnectGmail}
        disabled={connecting}
        className="mt-6 h-12 w-full gap-3 text-sm font-medium"
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Connect Gmail
      </Button>

      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
        Outlook also supported · revoke anytime in Settings
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 — PERSONALIZE
// ═══════════════════════════════════════════════════════════════════════════

// Screen 6 — Biggest email problem (multi, max 2)
export function Screen6Problem({ answers, onPatch }: ScreenProps) {
  const PROBLEMS: { id: EmailProblem; label: string; sub: string }[] = [
    { id: "too_much_volume", label: "Too much to process", sub: "Inbox feels endless" },
    { id: "miss_important",  label: "I miss what matters", sub: "Important threads buried" },
    { id: "slow_replies",    label: "Replies take too long", sub: "Spending hours writing" },
    { id: "no_followups",    label: "I forget to follow up", sub: "Things slip through" },
  ];

  const toggle = (id: EmailProblem) => {
    const has = answers.problems.includes(id);
    if (has) {
      onPatch({ problems: answers.problems.filter((p) => p !== id) });
    } else if (answers.problems.length < 2) {
      onPatch({ problems: [...answers.problems, id] });
    } else {
      // Replace oldest if at cap
      onPatch({ problems: [answers.problems[1], id] });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Pick up to two. We'll tune triage and the morning brief around these.
      </p>

      <div className="mt-6 grid gap-2.5">
        {PROBLEMS.map((p) => (
          <ExampleChip
            key={p.id}
            title={p.label}
            example={p.sub}
            selected={answers.problems.includes(p.id)}
            onClick={() => toggle(p.id)}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground/60">
        {answers.problems.length}/2 selected
      </p>
    </div>
  );
}

// Screen 7 — Tone (real example sentences)
export function Screen7Tone({ answers, onPatch }: ScreenProps) {
  const TONES: { id: ToneStyle; label: string; example: string }[] = [
    { id: "direct",       label: "Direct",       example: "Got it, let's move to Tuesday." },
    { id: "professional", label: "Professional", example: "Thank you for reaching out. I'd be happy to..." },
    { id: "warm",         label: "Warm",         example: "Hey! This sounds amazing — let's find a time." },
  ];

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Which sounds like an email you'd actually send? Drafts will match this.
      </p>

      <div className="mt-6 grid gap-2.5">
        {TONES.map((t) => (
          <ExampleChip
            key={t.id}
            title={t.label}
            example={t.example}
            selected={answers.tone === t.id}
            onClick={() => onPatch({ tone: t.id })}
          />
        ))}
      </div>
    </div>
  );
}

// Screen 8 — Deep persona (role + volume + use)
export function Screen8DeepPersona({ answers, onPatch }: ScreenProps) {
  const ROLES: { id: Role; label: string; icon: React.ReactNode }[] = [
    { id: "founder",    label: "Founder",     icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "engineer",   label: "Engineer",    icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: "pm",         label: "PM",          icon: <Target className="h-3.5 w-3.5" /> },
    { id: "consultant", label: "Consultant",  icon: <Users className="h-3.5 w-3.5" /> },
    { id: "investor",   label: "Investor",    icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: "other",      label: "Other",       icon: <User className="h-3.5 w-3.5" /> },
  ];

  const VOLUMES: { id: EmailVolume; label: string }[] = [
    { id: "lt20",    label: "<20" },
    { id: "20_50",   label: "20–50" },
    { id: "50_100",  label: "50–100" },
    { id: "gt100",   label: "100+" },
  ];

  const USES: { id: EmailUseCase; label: string }[] = [
    { id: "customer_sales",      label: "Customer & sales" },
    { id: "internal_team",       label: "Internal team" },
    { id: "investor_partner",    label: "Investors / partners" },
    { id: "newsletter_receipt",  label: "Newsletters & receipts" },
    { id: "personal",            label: "Personal" },
  ];

  const toggleUse = (id: EmailUseCase) => {
    const has = answers.useCases.includes(id);
    onPatch({
      useCases: has
        ? answers.useCases.filter((u) => u !== id)
        : [...answers.useCases, id],
    });
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Three quick taps. Shapes how the AI ranks and routes your inbox.
      </p>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">Role</p>
        <ChipGroup>
          {ROLES.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={answers.role === r.id}
              onClick={() => onPatch({ role: r.id })}
            />
          ))}
        </ChipGroup>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">Daily email volume</p>
        <ChipGroup>
          {VOLUMES.map((v) => (
            <Chip
              key={v.id}
              label={v.label}
              selected={answers.volume === v.id}
              onClick={() => onPatch({ volume: v.id })}
            />
          ))}
        </ChipGroup>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">
          Primary use <span className="text-muted-foreground/40">(pick all that apply)</span>
        </p>
        <ChipGroup>
          {USES.map((u) => (
            <Chip
              key={u.id}
              label={u.label}
              selected={answers.useCases.includes(u.id)}
              onClick={() => toggleUse(u.id)}
            />
          ))}
        </ChipGroup>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4 — AHA
// ═══════════════════════════════════════════════════════════════════════════

// Screen 9 — Syncing
//
// Artificial sequencing of phases gives the user a moment to read the priming
// copy and feel like real work is happening, even if their inbox loads in 2
// seconds. Three messages, ~1.5s each, then auto-advance.
export function Screen9Syncing({ goNext }: ScreenProps) {
  const PHASES = [
    "Reading your inbox…",
    "Finding what matters…",
    "Ranking by urgency…",
  ];
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    if (phaseIdx >= PHASES.length - 1) {
      const t = setTimeout(goNext, 1600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhaseIdx((p) => p + 1), 1500);
    return () => clearTimeout(t);
  }, [phaseIdx, goNext]);

  // Each skeleton card appears as phaseIdx advances
  const skeletonCards = [
    { subjectW: "62%", fromW: "28%", planLines: ["88%", "72%"] },
    { subjectW: "52%", fromW: "24%", planLines: ["80%", "65%", "45%"] },
    { subjectW: "68%", fromW: "30%", planLines: ["76%", "58%"] },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Morning brief skeleton header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1.5">
          <div className="h-5 w-40 rounded-full bg-white/20 animate-pulse" />
          <div className="h-3.5 w-24 rounded-full bg-white/10 animate-pulse" />
        </div>
        <motion.div
          className="h-5 w-5 rounded-full"
          style={{
            border: "2px solid rgba(255,255,255,0.15)",
            borderTopColor: "rgba(255,255,255,0.6)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Skeleton cards — appear one by one */}
      <div className="space-y-3 flex-1">
        {skeletonCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: phaseIdx >= i ? 1 : 0, y: phaseIdx >= i ? 0 : 6 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-white/10 bg-white/[0.05] p-4"
          >
            {/* Subject + sender */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                className="h-4 rounded-full bg-white/25 animate-pulse"
                style={{ width: card.subjectW, animationDelay: `${i * 120}ms` }}
              />
              <div
                className="h-3 rounded-full bg-white/12 animate-pulse shrink-0"
                style={{ width: card.fromW, animationDelay: `${i * 120 + 80}ms` }}
              />
            </div>
            {/* AI plan lines */}
            <div className="space-y-2 mb-3">
              {card.planLines.map((w, j) => (
                <div
                  key={j}
                  className="h-3 rounded-full bg-white/10 animate-pulse"
                  style={{ width: w, animationDelay: `${i * 120 + j * 80 + 100}ms` }}
                />
              ))}
            </div>
            {/* Accept plan button skeleton */}
            <div
              className="h-7 w-28 rounded-lg bg-white/10 animate-pulse"
              style={{ animationDelay: `${i * 120 + 260}ms` }}
            />
          </motion.div>
        ))}
      </div>

      {/* Phase status */}
      <motion.p
        key={phaseIdx}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 text-[12px] text-white/40"
      >
        {PHASES[phaseIdx]}
      </motion.p>
    </div>
  );
}

// Screen 10 — First morning brief preview
//
// Pulls the user's actual threads via app state. If <2 threads exist, falls
// back to two demo cards labeled as such — honest, not deceptive.
export function Screen10MorningBrief(_props: ScreenProps) {
  const { threads } = useAppState();

  // Pick up to 3 high-quality, human threads for the brief preview
  const realCards = threads
    .filter((t) => !isNoise(t) && t.isUnread)
    .sort((a, b) => scoreThread(b) - scoreThread(a))
    .slice(0, 3)
    .map((t) => ({
      subject: t.subject,
      from: t.participants[0]?.email ?? "—",
      plan: `${t.participants[0]?.name?.split(" ")[0] ?? t.participants[0]?.email?.split("@")[0] ?? "Someone"} needs a response. Dirac will draft a plan when you open this.`,
    }));

  const useDemo = realCards.length < 2;

  const cards = useDemo
    ? [
        { subject: "Q2 board update — needs your eyes", from: "lisa@acme.vc", plan: "Lisa is asking for the Q2 update by Friday. Reply with status and one open question." },
        { subject: "Series A follow-up", from: "founder@runway.io", plan: "Decline politely — not the right time. Suggest reconnecting in Q3." },
      ]
    : realCards;

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Every morning Dirac gives you this — the threads worth your time, with
        a plan for each.
      </p>

      {useDemo && (
        <p className="mt-2 text-[11px] text-muted-foreground/60">
          Your inbox is quiet right now — here's what a real brief looks like.
        </p>
      )}

      <div className="mt-5 space-y-2.5">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
            className="rounded-xl border border-border/60 bg-background/40 p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-[13px] font-semibold text-foreground truncate flex-1">
                {card.subject}
              </p>
              <span className="text-[11px] text-muted-foreground/70 shrink-0">{card.from.split("@")[0]}</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {card.plan}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Screen 11 — Accept a plan (interactive aha)
//
// The actual aha. User clicks the prominent "Accept plan" button. We show a
// short faux-AI animation of the sidebar materializing and "typing" a draft.
// We don't really send anything — that happens for real once they're in the
// app. The point is the FEELING of "click → AI takes over."
export function Screen11AcceptPlan({ goNext }: ScreenProps) {
  const { threads } = useAppState();
  const [accepted, setAccepted] = useState(false);
  const [typedChars, setTypedChars] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Pick the most compelling real thread; fall back to synthetic Lisa demo
  const bestThread = pickBestDemoThread(threads);
  const demo: DemoData = bestThread
    ? buildDemoFromThread(bestThread)
    : FALLBACK_DEMO;

  // The displayed draft — swaps to the chosen option's text after user picks
  const activeDraft =
    selectedOption !== null
      ? demo.adjustOptions[selectedOption].draft
      : demo.draftText;

  const draftDone = typedChars >= activeDraft.length;

  useEffect(() => {
    if (!accepted) return;
    if (draftDone) return;
    const t = setTimeout(
      () => setTypedChars((c) => Math.min(activeDraft.length, c + 3)),
      18,
    );
    return () => clearTimeout(t);
  }, [accepted, typedChars, activeDraft, draftDone]);

  // When user picks an option, re-type the new draft from scratch
  const handleOption = (idx: number) => {
    setSelectedOption(idx);
    setTypedChars(0);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Click <span className="font-medium text-foreground">Accept plan</span>.
        Watch what happens.
      </p>

      {/* Morning brief card — real email or fallback */}
      <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[12px] font-semibold text-foreground leading-snug flex-1">
            {demo.cardSubject}
          </p>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">
            {demo.cardFrom.split("@")[0]}
          </span>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          {demo.cardPlan}
        </p>
        {!accepted && (
          <Button
            size="sm"
            onClick={() => setAccepted(true)}
            className="mt-2.5 h-7 gap-1.5 text-xs"
          >
            Accept plan
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* AI draft block */}
      {accepted && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-xl border border-primary/30 bg-primary/[0.03] p-3.5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3 w-3 text-primary" />
            <p className="text-[10px] uppercase tracking-wider font-medium text-primary/80">
              AI sidebar · drafting
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">
            {activeDraft.slice(0, typedChars)}
            {!draftDone && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-[2px] h-[13px] bg-foreground ml-0.5 align-middle"
              />
            )}
          </p>
        </motion.div>
      )}

      {/* Quick-adjust MCQ panel — appears once initial draft finishes */}
      {draftDone && selectedOption === null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl border border-border/50 bg-muted/30 p-3.5"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2.5">
            Dirac · tune your reply
          </p>
          <div className="flex flex-col gap-2">
            {demo.adjustOptions.map((opt, i) => (
              <motion.button
                key={i}
                onClick={() => handleOption(i)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-left text-[12px] text-foreground/80 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground transition-colors"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.35 }}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Confirmation after option chosen + typing done */}
      {selectedOption !== null && draftDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 text-[12px] text-muted-foreground"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          Dirac matched your intent. That's the loop.
        </motion.div>
      )}

      {/* Continue — only after an option is picked and re-typed */}
      {selectedOption !== null && draftDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-auto pt-2"
        >
          <Button onClick={goNext} className="w-full h-10">
            Continue
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border/60 bg-background px-1 text-[10px] font-medium text-foreground/80"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5 — HABIT + DONE
// ═══════════════════════════════════════════════════════════════════════════

// Screen 12 — Notification opt-in
export function Screen12Notification({ answers, onPatch }: ScreenProps) {
  const [requesting, setRequesting] = useState(false);
  const [granted, setGranted] = useState<boolean | null>(null);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      if (typeof Notification !== "undefined") {
        const result = await Notification.requestPermission();
        const ok = result === "granted";
        setGranted(ok);
        onPatch({ enableMorningNotification: ok });
      } else {
        setGranted(false);
        onPatch({ enableMorningNotification: false });
      }
    } catch {
      setGranted(false);
      onPatch({ enableMorningNotification: false });
    } finally {
      setRequesting(false);
    }
  };

  const handleSkip = () => {
    onPatch({ enableMorningNotification: false });
    setGranted(false);
  };

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Your morning brief is ready every weekday at 8am. Want a nudge when it
        lands?
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Button
          size="lg"
          onClick={handleEnable}
          disabled={requesting || granted !== null}
          className="h-12 w-full gap-3"
        >
          {requesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : granted === true ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {granted === true ? "Notifications enabled" : "Enable notifications"}
        </Button>

        <button
          onClick={handleSkip}
          disabled={requesting || granted !== null}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Maybe later
        </button>
      </div>

      <div className="mt-auto pt-4 text-[11px] text-muted-foreground/60">
        You can change this anytime in Settings.
      </div>
    </div>
  );
}

// Screen 13 — Privacy reminder
export function Screen13Privacy(_props: ScreenProps) {
  const POINTS = [
    { icon: <Eye className="h-3.5 w-3.5" />, text: "Your inbox is read by AI, never by humans." },
    { icon: <Lock className="h-3.5 w-3.5" />, text: "No email content is stored on our servers." },
    { icon: <Shield className="h-3.5 w-3.5" />, text: "Models are never trained on your data." },
    { icon: <KeyRound className="h-3.5 w-3.5" />, text: "Disconnect anytime — Dirac forgets you." },
  ];

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Email is private. We treat it that way.
      </p>

      <div className="mt-6 space-y-3">
        {POINTS.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 px-4 py-3"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-foreground/70 shrink-0">
              {p.icon}
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">{p.text}</p>
          </motion.div>
        ))}
      </div>

      <p className="mt-auto pt-4 text-[11px] text-muted-foreground/60">
        Full details: <span className="underline">privacy policy</span>
      </p>
    </div>
  );
}

// Screen 14 — Setup summary
export function Screen14Summary({ answers }: ScreenProps) {
  const { data: session } = useSession();

  const items = [
    {
      label: "Account",
      value: session?.user?.email ?? "Connected",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    },
    {
      label: "Inbox",
      value: session?.gmailConnected ? "Gmail" : "Connected",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    },
    {
      label: "Tone",
      value: answers.tone ? capitalize(answers.tone) : "Default",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    },
    {
      label: "Morning brief",
      value: `8:00 AM${answers.enableMorningNotification ? " · with notification" : ""}`,
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Here's how Dirac is set up for you.
      </p>

      <div className="mt-6 space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              {item.icon}
              <span className="text-[12px] uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
            </div>
            <span className="text-[13px] font-medium text-foreground">{item.value}</span>
          </motion.div>
        ))}
      </div>

      <p className="mt-auto pt-4 text-[11px] text-muted-foreground/60">
        All of this is editable in Settings.
      </p>
    </div>
  );
}

// Screen 15 — Enter Dirac (immersive finale)
export function Screen15Enter({ goNext }: ScreenProps) {
  const handleEnterBrief = () => goNext();
  const handleEnterInbox = () => goNext();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground text-background mb-8 shadow-xl"
      >
        <Sparkles className="h-10 w-10" />
      </motion.div>

      <h2 className="text-[44px] leading-[1.05] font-semibold tracking-tight text-foreground">
        Your inbox is waiting.
      </h2>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Start with the morning brief, or just jump in.
      </p>

      <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
        <Button size="lg" onClick={handleEnterBrief} className="h-12 gap-2">
          <Sparkles className="h-4 w-4" />
          Open morning brief
        </Button>
        <Button size="lg" variant="ghost" onClick={handleEnterInbox} className="h-12">
          Go to inbox
        </Button>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
