"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SignupShell } from "./signup-shell";
import { ProgressStep } from "./progress-step";
import { PillToggle } from "./pill-toggle";
import { SignupPricing } from "./signup-pricing";
import type { Session } from "next-auth";
import type { EmailVolume, MainPainPoint, UserRole } from "@/lib/users-db";
import { fireSignupConfetti } from "@/lib/signup-confetti";

const STEP_STORAGE_KEY = "dirac_signup_step";
const INTRO_SEEN_KEY = "dirac_signup_intro_seen";
const OAUTH_PENDING_KEY = "dirac_signup_oauth_pending";
const AUTH_PROVIDER_KEY = "dirac_signup_auth_provider";
const EMAIL_PROVIDER_KEY = "dirac_signup_email_provider";

type AuthProvider = "google" | "microsoft";
type EmailProvider = "gmail" | "microsoft";

const GMAIL_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

function markOAuthPending(): void {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

function consumeOAuthPending(): boolean {
  try {
    if (sessionStorage.getItem(OAUTH_PENDING_KEY) === "1") {
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function clearOAuthPending(): void {
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Step 0 — tap-through intro (one sentence per screen). */
const INTRO_SCREENS = [
  "Welcome to Dirac!",
  "Your inbox isn't your to-do list — it's everyone else's priorities landing in your lap.",
  "Most founders start the day just figuring out what actually needs them.",
  "The average founder spends 11+ hours a week on email — about 28% of the workweek.",
] as const;

function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "founder_ceo", label: "Founder / CEO" },
  { value: "operator", label: "Operator (Chief of Staff / Ops)" },
  { value: "sales", label: "Sales / GTM" },
  { value: "product_engineering", label: "Product / Engineering" },
  { value: "investor", label: "Investor" },
  { value: "other", label: "Other" },
];

const VOLUME_OPTIONS: { value: EmailVolume; label: string }[] = [
  { value: "receipts", label: "Many small receipts and notifications" },
  { value: "cold_outreach", label: "Replying to varying cold outreach" },
  { value: "internal_investor", label: "Internal + investor email threads" },
  { value: "other", label: "Other" },
];

const PAIN_OPTIONS: { value: MainPainPoint; label: string }[] = [
  { value: "volume", label: "Keeping up with volume" },
  { value: "replies", label: "Writing replies" },
  { value: "missing_important", label: "Missing important emails" },
  { value: "other", label: "Other" },
];

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const AUTH_REASON_MESSAGES: Record<string, string> = {
  no_nextauth_jwt:
    "Google session was not found on the server. On Vercel, set AUTH_SECRET or NEXTAUTH_SECRET and NEXTAUTH_URL=https://app.dirac.app.",
  missing_auth_secret:
    "Server is missing AUTH_SECRET / NEXTAUTH_SECRET. Add it in Vercel → Project → Environment Variables.",
  missing_google_id_token:
    "Google did not return an ID token. Try signing in again.",
  id_token_exchange_failed:
    "Could not link your Google account to Dirac. Check Supabase Google provider settings.",
  supabase_user_missing: "Account link did not complete. Please try again.",
  provision_failed: "We could not finish setting up your account. Please try again.",
  google_session_invalid: "Sign-in session is invalid. Please sign in again.",
};

function authErrorMessage(reason: string | null): string {
  if (!reason) return "Sign-in failed. Please try again.";
  if (AUTH_REASON_MESSAGES[reason]) return AUTH_REASON_MESSAGES[reason];
  if (reason.startsWith("id_token_exchange_failed:")) {
    return "Could not link Google to Dirac. Check Supabase Google Client ID matches GOOGLE_CLIENT_ID.";
  }
  return `Sign-in failed (${reason}). Please try again.`;
}

function gmailReady(session: Session | null | undefined): boolean {
  return Boolean(session?.gmailConnected && session?.accessToken && !session?.error);
}

export function SignupFlow() {
  const router = useRouter();
  const { data: session, status: nextAuthStatus } = useSession();
  const [step, setStep] = useState<Step>(0);
  const [introIndex, setIntroIndex] = useState(0);
  const [booting, setBooting] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailVolume, setEmailVolume] = useState<EmailVolume | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [mainPainPoint, setMainPainPoint] = useState<MainPainPoint | null>(null);
  const [userRoleOther, setUserRoleOther] = useState("");
  const [emailVolumeOther, setEmailVolumeOther] = useState("");
  const [mainPainPointOther, setMainPainPointOther] = useState("");
  const [savingAnswers, setSavingAnswers] = useState(false);

  const answersComplete =
    !!userRole &&
    !!emailVolume &&
    !!mainPainPoint &&
    (userRole !== "other" || userRoleOther.trim().length > 0) &&
    (emailVolume !== "other" || emailVolumeOther.trim().length > 0) &&
    (mainPainPoint !== "other" || mainPainPointOther.trim().length > 0);

  // Step 5 (connect) — Gmail consent checkbox
  const [gmailConsentChecked, setGmailConsentChecked] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [emailProvider, setEmailProvider] = useState<EmailProvider | null>(null);
  const [outlookConnected, setOutlookConnected] = useState(false);

  const persistStep = useCallback((s: Step) => {
    try {
      localStorage.setItem(STEP_STORAGE_KEY, String(s));
    } catch {
      /* ignore */
    }
  }, []);

  const goToStep = useCallback(
    (s: Step) => {
      setStep(s);
      if (s >= 1) persistStep(s);
      if (s >= 2) markIntroSeen();
    },
    [persistStep],
  );

  const advanceIntro = useCallback(() => {
    if (introIndex < INTRO_SCREENS.length - 1) {
      setIntroIndex((i) => i + 1);
      return;
    }
    markIntroSeen();
    setStep(1);
  }, [introIndex]);

  const chooseEmailProvider = useCallback(
    (provider: EmailProvider) => {
      setEmailProvider(provider);
      try {
        localStorage.setItem(EMAIL_PROVIDER_KEY, provider);
      } catch {
        /* ignore */
      }
      goToStep(5);
    },
    [goToStep],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (params.get("error") === "auth") {
      clearOAuthPending();
      const msg = authErrorMessage(reason);
      setError(msg);
    }
    if (params.get("error") === "provision") {
      clearOAuthPending();
      setError("We could not finish setting up your account. Please try again.");
    }

    async function boot() {
      if (nextAuthStatus === "loading") return;

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session: supabaseSession },
      } = await supabase.auth.getSession();

      const hasGmail = gmailReady(session);
      const afterGmail = params.get("after") === "gmail";
      const afterOutlook = params.get("after") === "outlook";
      const afterMicrosoft = params.get("after") === "microsoft";
      const outlookStatus = params.get("outlook");
      const paymentSuccess = params.get("payment") === "success";
      const paymentCancelled = params.get("payment") === "cancelled";
      const stripeSessionId = params.get("session_id");

      const savedEmail = localStorage.getItem(EMAIL_PROVIDER_KEY) as EmailProvider | null;
      if (savedEmail === "gmail" || savedEmail === "microsoft") {
        setEmailProvider(savedEmail);
      }
      const savedAuth = localStorage.getItem(AUTH_PROVIDER_KEY) as AuthProvider | null;
      if (savedAuth === "microsoft") setMicrosoftConnected(true);
      if (savedAuth === "google") setGoogleConnected(true);

      function resolveResumeStep(hasPayment: boolean): Step {
        const savedStep = Number(localStorage.getItem(STEP_STORAGE_KEY));
        if (savedStep >= 2 && savedStep <= 6) {
          if (savedStep >= 4 && !hasPayment) return 3;
          if (savedStep === 5 && !localStorage.getItem(EMAIL_PROVIDER_KEY)) return 4;
          return savedStep as Step;
        }
        return hasPayment ? 4 : 2;
      }

      // --- Returning from Outlook OAuth (step 5 → 6) ---
      if (afterOutlook && outlookStatus === "connected" && supabaseSession) {
        setOutlookConnected(true);
        goToStep(6);
        setBooting(false);
        return;
      }
      if (afterOutlook && outlookStatus === "error") {
        setError("Could not connect Microsoft. Please try again.");
        goToStep(5);
        setBooting(false);
        return;
      }

      // --- Returning from Gmail OAuth (step 5 → 6) ---
      if (afterGmail && nextAuthStatus === "authenticated" && hasGmail && supabaseSession) {
        goToStep(6);
        setBooting(false);
        return;
      }

      // --- Returning from Microsoft account sign-in (step 1 → 2) ---
      if (afterMicrosoft && supabaseSession) {
        if (consumeOAuthPending()) {
          try {
            localStorage.setItem(AUTH_PROVIDER_KEY, "microsoft");
          } catch {
            /* ignore */
          }
          setMicrosoftConnected(true);
          void fireSignupConfetti();
        }
        goToStep(2);
        setBooting(false);
        return;
      }

      // --- Returning from Stripe checkout (step 3 → step 4: provider choice) ---
      if (paymentSuccess && stripeSessionId && supabaseSession) {
        setVerifyingPayment(true);
        try {
          const res = await fetch(`/api/stripe/verify-payment?session_id=${stripeSessionId}`);
          if (res.ok) {
            goToStep(4);
            setBooting(false);
            setVerifyingPayment(false);
            return;
          }
          setError("Could not verify payment. If you were charged, please contact support.");
        } catch {
          setError("Network error verifying payment. Please try again.");
        }
        setVerifyingPayment(false);
        goToStep(3);
        setBooting(false);
        return;
      }

      // --- Payment cancelled ---
      if (paymentCancelled) {
        goToStep(3);
        setBooting(false);
        return;
      }

      // --- Google sign-in: link NextAuth → Supabase ---
      if (nextAuthStatus === "authenticated" && !supabaseSession) {
        setLinkingAccount(true);
        try {
          const res = await fetch("/api/auth/link-supabase", { method: "POST" });
          const data = (await res.json()) as { ok?: boolean; reason?: string };
          if (res.ok) {
            await supabase.auth.getSession();
            if (consumeOAuthPending()) {
              try {
                localStorage.setItem(AUTH_PROVIDER_KEY, "google");
              } catch {
                /* ignore */
              }
              setGoogleConnected(true);
              void fireSignupConfetti();
            }
            goToStep(2);
            setBooting(false);
            setLinkingAccount(false);
            return;
          }
          clearOAuthPending();
          setError(authErrorMessage(data.reason ?? null));
          setStep(1);
        } catch {
          clearOAuthPending();
          setError("Network error while linking account. Please try again.");
          setStep(1);
        }
        setBooting(false);
        setLinkingAccount(false);
        return;
      }

      // --- Supabase session present — resume (Google + Microsoft signups) ---
      if (supabaseSession) {
        try {
          const profileRes = await fetch("/api/user/profile");
          if (profileRes.ok) {
            const profile = (await profileRes.json()) as {
              onboarding_completed_at?: string | null;
              stripe_customer_id?: string | null;
            };
            if (profile.onboarding_completed_at) {
              router.replace("/inbox");
              return;
            }
            goToStep(resolveResumeStep(!!profile.stripe_customer_id));
            setBooting(false);
            return;
          }
        } catch {
          /* ignore, fall through */
        }

        goToStep(resolveResumeStep(false));
        setBooting(false);
        return;
      }

      // No session — show intro once, then sign-in
      const savedSignupStep = Number(localStorage.getItem(STEP_STORAGE_KEY));
      if (!hasSeenIntro() && !(savedSignupStep >= 2)) {
        setIntroIndex(0);
        setStep(0);
      } else {
        if (savedSignupStep >= 2) markIntroSeen();
        setStep(1);
      }
      setBooting(false);
    }

    void boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAuthStatus, session]);

  useEffect(() => {
    if (step === 5 && !emailProvider) {
      goToStep(4);
    }
  }, [step, emailProvider, goToStep]);

  async function handleGoogleSignup() {
    setAuthLoading(true);
    setError(null);
    markOAuthPending();
    await signIn(
      "google",
      { callbackUrl: "/signup" },
      { scope: "openid email profile", prompt: "select_account" },
    );
  }

  async function handleMicrosoftSignup() {
    setAuthLoading(true);
    setError(null);
    markOAuthPending();
    const supabase = createSupabaseBrowserClient();
    const next = encodeURIComponent("/signup?after=microsoft");
    const redirectTo = `${window.location.origin}/auth/callback?next=${next}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo, scopes: "email profile openid" },
    });
    if (oauthError) {
      setAuthLoading(false);
      setError("Could not start Microsoft sign-in. Please try again.");
    }
  }

  async function handleSaveQuestions() {
    if (!answersComplete) return;
    setSavingAnswers(true);
    setError(null);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_role: userRole,
          email_volume: emailVolume,
          main_pain_point: mainPainPoint,
          ...(userRoleOther ? { user_role_other: userRoleOther } : {}),
          ...(emailVolumeOther ? { email_volume_other: emailVolumeOther } : {}),
          ...(mainPainPointOther ? { main_pain_point_other: mainPainPointOther } : {}),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      goToStep(3);
    } catch {
      setError("Could not save your answers. Please try again.");
    } finally {
      setSavingAnswers(false);
    }
  }

  async function handleConnectGmail() {
    setAuthLoading(true);
    setError(null);
    persistStep(5);
    await signIn(
      "google",
      { callbackUrl: "/signup?after=gmail" },
      {
        scope: GMAIL_SCOPE,
        access_type: "offline",
        prompt: "consent",
      },
    );
  }

  function handleConnectOutlook() {
    setAuthLoading(true);
    setError(null);
    persistStep(5);
    const returnTo = encodeURIComponent("/signup?after=outlook");
    window.location.href = `/api/oauth/outlook?returnTo=${returnTo}`;
  }

  async function handleOpenInbox() {
    try {
      await fetch("/api/user/onboarding/complete", { method: "POST" });
      localStorage.removeItem(STEP_STORAGE_KEY);
      localStorage.removeItem(AUTH_PROVIDER_KEY);
      localStorage.removeItem(EMAIL_PROVIDER_KEY);
    } catch (err) {
      console.error("[signup] complete:", err);
    }
    router.push("/inbox");
  }

  if (booting || nextAuthStatus === "loading" || linkingAccount || verifyingPayment) {
    return (
      <SignupShell>
        <p className="text-center text-sm text-zinc-500">
          {linkingAccount
            ? "Connecting your Google account…"
            : verifyingPayment
              ? "Confirming your payment…"
              : "Loading…"}
        </p>
      </SignupShell>
    );
  }

  return (
    <SignupShell>
      <AnimatePresence mode="wait">

        {/* ── Step 0: Intro tap-through ── */}
        {step === 0 && (
          <motion.button
            key={`intro-${introIndex}`}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            onClick={advanceIntro}
            className="flex min-h-[min(420px,55vh)] w-full cursor-pointer flex-col items-start justify-center border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A3D]/50"
            aria-label="Continue"
          >
            <p className="text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
              {INTRO_SCREENS[introIndex]}
            </p>
            <div className="mt-10 flex gap-1.5" aria-hidden>
              {INTRO_SCREENS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === introIndex ? "w-6 bg-[#FF8A3D]" : "w-1.5 bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </motion.button>
        )}

        {/* ── Step 1: Sign in with Google (basic scopes) ── */}
        {step === 1 && (
          <motion.div key="s1" {...fadeUp} transition={{ duration: 0.35 }}>

            {/* Founding badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#FF8A3D]/30 bg-[#FF8A3D]/8 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A3D]" aria-hidden />
              <span className="text-xs font-medium tracking-wide text-[#FF8A3D]">
                Founding members — first 100 only
              </span>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Your inbox, handled.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-400">
              A decision-first inbox for founders who move fast on email.
            </p>

            {/* Feature list */}
            <ul className="mt-7 space-y-2.5">
              {[
                "AI triage, summaries, and reply drafts in your voice",
                "Morning Brief — daily priority list with a plan",
                "Snooze, archive, and act on threads in seconds",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF8A3D]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            {/* Divider */}
            <div className="my-8 h-px bg-zinc-800" />

            <button
              type="button"
              onClick={() => void handleGoogleSignup()}
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2.5 bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <GoogleIcon />
              {authLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            <button
              type="button"
              onClick={() => void handleMicrosoftSignup()}
              disabled={authLoading}
              className="mt-3 flex w-full items-center justify-center gap-2.5 border border-zinc-700 bg-zinc-950/40 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:border-zinc-600 hover:bg-zinc-900/60 disabled:opacity-60"
            >
              <MicrosoftIcon />
              Continue with Microsoft
            </button>

            <p className="mt-4 text-center text-xs text-zinc-500">
              7-day free trial · Cancel anytime · Card required
            </p>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {/* ── Step 2: Survey questions ── */}
        {step === 2 && (
          <motion.div key="s2" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={1} total={3} />
            <AnimatePresence>
              {(googleConnected || microsoftConnected) && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-sm font-medium text-[#FF8A3D]"
                >
                  {microsoftConnected
                    ? "Microsoft connected — you're signed in."
                    : "Google connected — you're signed in."}
                </motion.p>
              )}
            </AnimatePresence>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Quick question before you go in.
            </h1>

            <div className="mt-10 space-y-8">
              <div>
                <p className="mb-3 text-sm text-zinc-400">What is your role?</p>
                <PillToggle
                  options={ROLE_OPTIONS}
                  value={userRole}
                  onChange={setUserRole}
                  otherText={userRoleOther}
                  onOtherTextChange={setUserRoleOther}
                  otherPlaceholder="Your role"
                />
              </div>
              <div>
                <p className="mb-3 text-sm text-zinc-400">What best describes your inbox?</p>
                <PillToggle
                  options={VOLUME_OPTIONS}
                  value={emailVolume}
                  onChange={setEmailVolume}
                  otherText={emailVolumeOther}
                  onOtherTextChange={setEmailVolumeOther}
                  otherPlaceholder="Describe your inbox"
                />
              </div>
              <div>
                <p className="mb-3 text-sm text-zinc-400">What&apos;s your biggest email problem?</p>
                <PillToggle
                  options={PAIN_OPTIONS}
                  value={mainPainPoint}
                  onChange={setMainPainPoint}
                  otherText={mainPainPointOther}
                  onOtherTextChange={setMainPainPointOther}
                  otherPlaceholder="What's the main problem?"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!answersComplete || savingAnswers}
              onClick={() => void handleSaveQuestions()}
              className="mt-10 w-full border border-[#FF8A3D] bg-[#FF8A3D]/10 px-4 py-3.5 text-sm font-medium text-white transition-opacity disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
            >
              {savingAnswers ? "Saving…" : "Continue"}
            </button>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {/* ── Step 3: Payment (Stripe Checkout) ── */}
        {step === 3 && (
          <motion.div key="s3" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={2} total={3} />
            <SignupPricing />
            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {/* ── Step 4: Choose email provider ── */}
        {step === 4 && (
          <motion.div key="s4" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={3} total={3} />
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Which email do you use?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pick the inbox you want Dirac to connect to. One connection — that&apos;s the whole setup.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseEmailProvider("gmail")}
                className="flex flex-col items-start gap-3 border border-zinc-800 bg-zinc-950/40 px-4 py-5 text-left transition-colors hover:border-zinc-600"
              >
                <GoogleIcon />
                <div>
                  <p className="text-sm font-medium text-white">I use Gmail</p>
                  <p className="mt-1 text-xs text-zinc-500">Google Workspace or @gmail.com</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => chooseEmailProvider("microsoft")}
                className="flex flex-col items-start gap-3 border border-zinc-800 bg-zinc-950/40 px-4 py-5 text-left transition-colors hover:border-zinc-600"
              >
                <MicrosoftIcon />
                <div>
                  <p className="text-sm font-medium text-white">I use Microsoft</p>
                  <p className="mt-1 text-xs text-zinc-500">Outlook, Microsoft 365, Hotmail</p>
                </div>
              </button>
            </div>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {/* ── Step 5: Connect inbox (Gmail or Microsoft) ── */}
        {step === 5 && emailProvider === "gmail" && (
          <motion.div key="s5-gmail" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={3} total={3} />
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Connect your inbox. That&apos;s the whole setup.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Dirac needs Gmail access to read, triage, and draft replies.
            </p>

            {/* Founder note about unverified app warning */}
            <div className="mt-8 rounded-sm border border-zinc-800/80 bg-zinc-950/40 px-4 py-4 text-sm leading-relaxed text-zinc-400">
              <p className="font-medium text-zinc-300">You&apos;ll see an &ldquo;unverified app&rdquo; warning from Google.</p>
              <p className="mt-2 text-zinc-500">
                Dirac is currently in review. To continue:
              </p>
              <ol className="mt-2 space-y-1 pl-4 text-zinc-500 list-decimal">
                <li>Click <span className="font-medium text-zinc-300">Advanced</span></li>
                <li>Click <span className="font-medium text-zinc-300">Go to Dirac (unsafe)</span></li>
              </ol>
              <p className="mt-3 text-zinc-600 text-xs">
                Your data is used only to run Dirac — never sold or shared.
              </p>
            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={gmailConsentChecked}
                onChange={(e) => setGmailConsentChecked(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[#FF8A3D]"
              />
              <span className="text-sm text-zinc-400">
                I understand — connect my Gmail to Dirac.
              </span>
            </label>

            <AnimatePresence>
              {gmailConsentChecked && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <p className="text-sm leading-relaxed text-zinc-500 sm:flex-1">
                    Nervous about handing this over? That&apos;s good. Dirac will earn that trust from you.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleConnectGmail()}
                    disabled={authLoading}
                    className="flex w-full shrink-0 items-center justify-center gap-2.5 bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
                  >
                    <GoogleIcon />
                    {authLoading ? "Redirecting…" : "Connect Gmail →"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {step === 5 && emailProvider === "microsoft" && (
          <motion.div key="s5-microsoft" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={3} total={3} />
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Connect your inbox. That&apos;s the whole setup.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Dirac needs Outlook access to read, triage, and draft replies.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <p className="text-sm leading-relaxed text-zinc-500 sm:flex-1">
                Nervous about handing this over? That&apos;s good. Dirac will earn that trust from you.
              </p>
              <button
                type="button"
                onClick={handleConnectOutlook}
                disabled={authLoading || outlookConnected}
                className="flex w-full shrink-0 items-center justify-center gap-2.5 bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                <MicrosoftIcon />
                {outlookConnected ? "Connected" : authLoading ? "Redirecting…" : "Connect Microsoft →"}
              </button>
            </div>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {/* ── Step 6: You're in ── */}
        {step === 6 && (
          <motion.div key="s6" {...fadeUp} transition={{ duration: 0.35 }}>
            <h1 className="text-4xl font-semibold tracking-tight text-white">You&apos;re in.</h1>

            <ul className="mt-10 space-y-3">
              {[
                "Morning Brief highlights what matters and your plan for each thread.",
                "Ask the AI to sort your inbox while you wait.",
                "Everything else is already handled.",
              ].map((line, i) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 * i, duration: 0.4 }}
                  className="text-sm leading-relaxed text-zinc-400"
                >
                  {line}
                </motion.li>
              ))}
            </ul>

            <div
              className="mt-10 h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,138,61,0.45), transparent)",
              }}
            />

            <button
              type="button"
              onClick={() => void handleOpenInbox()}
              className="mt-8 w-full bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Open my inbox →
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </SignupShell>
  );
}
