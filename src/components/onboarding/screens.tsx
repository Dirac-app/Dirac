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
    try {
      await signIn("google", { redirect: false });
    } finally {
      setSigningIn(false);
    }
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
  const isConnected = Boolean(session?.gmailConnected || session?.outlookConnected);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => goNext(), 1100);
      return () => clearTimeout(t);
    }
  }, [isConnected, goNext]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      // Gmail re-uses the Google account — request the gmail scopes.
      await signIn("google", { redirect: false });
    } finally {
      setConnecting(false);
    }
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
    { label: "Reading your inbox…",          icon: <Inbox className="h-4 w-4" /> },
    { label: "Finding what matters…",        icon: <Sparkles className="h-4 w-4" /> },
    { label: "Ranking by urgency…",          icon: <TrendingUp className="h-4 w-4" /> },
  ];
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    if (phaseIdx >= PHASES.length - 1) {
      const t = setTimeout(goNext, 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhaseIdx((p) => p + 1), 1400);
    return () => clearTimeout(t);
  }, [phaseIdx, goNext]);

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-foreground/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{
            borderTopColor: "hsl(var(--foreground))",
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
            borderLeftColor: "transparent",
          }}
        />
        <Sparkles className="h-6 w-6 text-foreground" />
      </div>

      <div className="space-y-3 min-h-[80px]">
        {PHASES.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: i <= phaseIdx ? 1 : 0.25,
              y: 0,
            }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-2 text-[15px]"
          >
            <span className={cn(i === phaseIdx ? "text-foreground" : "text-muted-foreground/60")}>
              {p.icon}
            </span>
            <span className={cn(i === phaseIdx ? "text-foreground font-medium" : "text-muted-foreground/60")}>
              {p.label}
            </span>
            {i < phaseIdx && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Screen 10 — First morning brief preview
//
// Pulls the user's actual threads via app state. If <2 threads exist, falls
// back to two demo cards labeled as such — honest, not deceptive.
export function Screen10MorningBrief(_props: ScreenProps) {
  const { threads } = useAppState();
  const sampleThreads = threads
    .filter((t) => !t.read)
    .slice(0, 3);

  const useDemo = sampleThreads.length < 2;

  const cards = useDemo
    ? [
        { subject: "Q2 board update — needs your eyes", from: "lisa@acme.vc", plan: "Lisa is asking for the Q2 update by Friday. Reply with status and one open question." },
        { subject: "Series A follow-up", from: "founder@runway.io", plan: "Decline politely — not the right time. Suggest reconnecting in Q3." },
      ]
    : sampleThreads.map((t) => ({
        subject: t.subject,
        from: t.participants[0]?.email ?? "—",
        plan: "Dirac will draft a plan for this once you click in.",
      }));

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
  const [accepted, setAccepted] = useState(false);
  const [typedChars, setTypedChars] = useState(0);

  const draftText = "Hi Lisa — here's the Q2 update. Revenue tracked +18% MoM, two key hires landed, and the Series A conversations are progressing. Open question: should we accelerate the security audit ahead of the round?\n\n— ";

  useEffect(() => {
    if (!accepted) return;
    if (typedChars >= draftText.length) {
      // Hold on the finished draft for a beat, then unlock Next.
      return;
    }
    const t = setTimeout(() => setTypedChars((c) => Math.min(draftText.length, c + 3)), 18);
    return () => clearTimeout(t);
  }, [accepted, typedChars, draftText.length]);

  return (
    <div className="flex h-full flex-col">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Click <span className="font-medium text-foreground">Accept plan</span>.
        Watch what happens.
      </p>

      <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
        <p className="text-[13px] font-semibold text-foreground mb-1">
          Q2 board update — needs your eyes
        </p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Lisa is asking for the Q2 update by Friday. Reply with status and one
          open question.
        </p>

        {!accepted && (
          <Button
            size="sm"
            onClick={() => setAccepted(true)}
            className="mt-3 h-8 gap-1.5 text-xs"
          >
            Accept plan
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {accepted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-wider font-medium text-primary/80">
              AI sidebar · drafting
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
            {draftText.slice(0, typedChars)}
            {typedChars < draftText.length && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-[2px] h-[14px] bg-foreground ml-0.5 align-middle"
              />
            )}
          </p>
        </motion.div>
      )}

      {typedChars >= draftText.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          That's the loop. Dirac handles the rest from here.
        </motion.div>
      )}

      {/* Keyboard shortcut overlay — appears once draft is done */}
      {typedChars >= draftText.length && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="mt-4 rounded-lg border border-border/40 bg-muted/20 px-4 py-3"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
            Keyboard shortcuts
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
            <Shortcut keys={["J", "K"]} label="navigate threads" />
            <Shortcut keys={["R"]} label="reply" />
            <Shortcut keys={["⌘", "/"]} label="ask AI" />
          </div>
        </motion.div>
      )}

      {typedChars >= draftText.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-auto pt-4"
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
      value: session?.gmailConnected ? "Gmail" : session?.outlookConnected ? "Outlook" : "Connected",
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
