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
const OAUTH_PENDING_KEY = "dirac_signup_oauth_pending";

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

type Step = 1 | 2 | 3 | 4 | 5;

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

const SETUP_ITEMS = [
  "Connecting your inbox...",
  "Analysing your writing style...",
  "Preparing your Morning Brief...",
] as const;

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

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const AUTH_REASON_MESSAGES: Record<string, string> = {
  no_nextauth_jwt:
    "Google session was not found on the server. On Vercel, set AUTH_SECRET or NEXTAUTH_SECRET (not TESTER_JWT_SECRET) and NEXTAUTH_URL=https://app.dirac.app.",
  missing_auth_secret:
    "Server is missing AUTH_SECRET / NEXTAUTH_SECRET. Add it in Vercel → Project → Environment Variables.",
  missing_google_id_token:
    "Google did not return an ID token. Try signing in again.",
  id_token_exchange_failed: "Could not link your Google account to Dirac. Check Supabase Google provider settings.",
  supabase_user_missing: "Account link did not complete. Please try again.",
  provision_failed: "We could not finish setting up your account. Please try again.",
  gmail_not_connected:
    "Gmail wasn't connected. Sign in again with Google and approve inbox access.",
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
  const [step, setStep] = useState<Step>(1);
  const [booting, setBooting] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
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

  const [checkIndex, setCheckIndex] = useState(-1);
  const [checksDone, setChecksDone] = useState(false);
  const [showReadyNote, setShowReadyNote] = useState(false);
  const [showSetupCta, setShowSetupCta] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

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
      persistStep(s);
    },
    [persistStep],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (params.get("error") === "auth") {
      clearOAuthPending();
      const msg = authErrorMessage(reason);
      setError(msg);
      console.error("[signup] auth error", { reason, message: msg });
    }
    if (params.get("error") === "provision") {
      clearOAuthPending();
      setError("We could not finish setting up your account. Please try again.");
    }

    function celebrateGoogleSignup() {
      setGoogleConnected(true);
      void fireSignupConfetti();
    }

    async function boot() {
      if (nextAuthStatus === "loading") return;

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session: supabaseSession },
      } = await supabase.auth.getSession();

      const hasGmail = gmailReady(session);

      // Supabase billing row without Gmail tokens — must re-auth with NextAuth.
      if (supabaseSession && nextAuthStatus === "authenticated" && !hasGmail) {
        setStep(1);
        setError(authErrorMessage("gmail_not_connected"));
        setBooting(false);
        return;
      }

      if (supabaseSession && !hasGmail && nextAuthStatus === "unauthenticated") {
        setStep(1);
        setError(
          "Your account exists but Gmail isn't connected. Sign in with Google below to link your inbox.",
        );
        setBooting(false);
        return;
      }

      if (nextAuthStatus === "authenticated" && hasGmail && !supabaseSession) {
        setLinkingAccount(true);
        try {
          const res = await fetch("/api/auth/link-supabase", { method: "POST" });
          const data = (await res.json()) as { ok?: boolean; reason?: string; error?: string };
          if (res.ok) {
            await supabase.auth.getSession();
            setStep(2);
            persistStep(2);
            setError(null);
            if (consumeOAuthPending()) celebrateGoogleSignup();
            setBooting(false);
            setLinkingAccount(false);
            return;
          }
          clearOAuthPending();
          const msg = authErrorMessage(data.reason ?? reason);
          setError(msg);
          console.error("[signup] link-supabase failed", data);
          setStep(1);
          setBooting(false);
          setLinkingAccount(false);
          return;
        } catch (err) {
          clearOAuthPending();
          console.error("[signup] link-supabase network error", err);
          setError("Network error while linking your account. Please try again.");
          setStep(1);
          setBooting(false);
          setLinkingAccount(false);
          return;
        }
      }

      if (supabaseSession && hasGmail) {
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const profile = (await res.json()) as { onboarding_completed_at: string | null };
            if (profile.onboarding_completed_at) {
              router.replace("/inbox");
              return;
            }
            const saved = Number(localStorage.getItem(STEP_STORAGE_KEY));
            if (saved >= 2 && saved <= 5) {
              setStep(saved as Step);
            } else {
              setStep(2);
            }
          } else {
            setStep(2);
          }
        } catch {
          setStep(2);
        }
        if (consumeOAuthPending()) celebrateGoogleSignup();
        setBooting(false);
        return;
      }

      setStep(1);
      setBooting(false);
    }

    void boot();
  }, [nextAuthStatus, session, router, persistStep]);

  async function handleGoogleSignup() {
    setAuthLoading(true);
    setError(null);
    markOAuthPending();
    persistStep(2);
    await signIn("google", {
      callbackUrl: `/auth/complete?next=${encodeURIComponent("/signup")}`,
    });
    setAuthLoading(false);
  }

  async function handleSaveQuestions() {
    if (!answersComplete || !userRole || !emailVolume || !mainPainPoint) return;
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
          ...(userRole === "other" && { user_role_other: userRoleOther.trim() }),
          ...(emailVolume === "other" && { email_volume_other: emailVolumeOther.trim() }),
          ...(mainPainPoint === "other" && { main_pain_point_other: mainPainPointOther.trim() }),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      goToStep(3);
    } catch {
      setError("Could not save your answers. Please try again.");
    } finally {
      setSavingAnswers(false);
    }
  }

  useEffect(() => {
    if (step !== 4) return;

    setCheckIndex(-1);
    setChecksDone(false);
    setShowReadyNote(false);
    setShowSetupCta(false);

    void fetch("/api/user/onboarding/setup", { method: "POST" }).catch((err) => {
      console.error("[signup] setup:", err);
    });

    const timers: ReturnType<typeof setTimeout>[] = [];

    SETUP_ITEMS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setCheckIndex(i);
        }, i * 800),
      );
    });

    timers.push(
      setTimeout(() => {
        setChecksDone(true);
        setShowReadyNote(true);
      }, SETUP_ITEMS.length * 800 + 400),
    );

    timers.push(
      setTimeout(() => {
        setShowSetupCta(true);
      }, SETUP_ITEMS.length * 800 + 900),
    );

    return () => timers.forEach(clearTimeout);
  }, [step]);

  async function handleOpenInbox() {
    try {
      await fetch("/api/user/onboarding/complete", { method: "POST" });
      localStorage.removeItem(STEP_STORAGE_KEY);
    } catch (err) {
      console.error("[signup] complete:", err);
    }
    router.push("/inbox");
  }

  if (booting || nextAuthStatus === "loading" || linkingAccount) {
    return (
      <SignupShell>
        <p className="text-center text-sm text-zinc-500">
          {linkingAccount ? "Connecting your Google account…" : "Loading…"}
        </p>
      </SignupShell>
    );
  }

  return (
    <SignupShell>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" {...fadeUp} transition={{ duration: 0.35 }}>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Your inbox, handled.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              Join founders who&apos;ve stopped letting email run their day.
            </p>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={authLoading}
              className="mt-10 flex w-full items-center justify-center gap-2.5 bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <GoogleIcon />
              {authLoading ? "Redirecting…" : "Sign up & connect Google"}
            </button>

            <p className="mt-4 text-center text-xs text-zinc-500">
              14-day free trial · No credit card required
            </p>
            <p className="mt-1 text-center text-[11px] text-zinc-600">
              Data stays local while Dirac learns your inbox.
            </p>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={1} />
            <AnimatePresence>
              {googleConnected && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-sm font-medium text-[#FF8A3D]"
                >
                  Google connected — you&apos;re signed in.
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
                  otherPlaceholder="What’s the main problem?"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!answersComplete || savingAnswers}
              onClick={handleSaveQuestions}
              className="mt-10 w-full border border-[#FF8A3D] bg-[#FF8A3D]/10 px-4 py-3.5 text-sm font-medium text-white transition-opacity disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
            >
              {savingAnswers ? "Saving…" : "Continue"}
            </button>

            {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={2} />
            <SignupPricing onContinue={() => goToStep(4)} />
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" {...fadeUp} transition={{ duration: 0.35 }}>
            <ProgressStep current={3} />
            <h1 className="text-3xl font-semibold tracking-tight text-white">Setting up your Dirac.</h1>

            <ul className="mt-10 space-y-4">
              {SETUP_ITEMS.map((label, i) => {
                const done = checksDone || checkIndex > i;
                const active = checkIndex === i && !checksDone;
                return (
                  <motion.li
                    key={label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={
                      active || done ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 0 }
                    }
                    transition={{ duration: 0.35 }}
                    className="text-sm text-zinc-300"
                  >
                    {done ? (
                      <span>
                        {label.replace("...", "")}{" "}
                        <span className="text-[#FF8A3D]">✓</span>
                      </span>
                    ) : (
                      label
                    )}
                  </motion.li>
                );
              })}
            </ul>

            <AnimatePresence>
              {showReadyNote && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 text-sm font-medium text-zinc-300"
                >
                  Your inbox is ready.
                </motion.p>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSetupCta && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => goToStep(5)}
                  className="mt-8 w-full border border-[#FF8A3D] bg-[#FF8A3D]/10 px-4 py-3.5 text-sm font-medium text-white"
                >
                  Go to my inbox →
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="s5" {...fadeUp} transition={{ duration: 0.35 }}>
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
              onClick={handleOpenInbox}
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
