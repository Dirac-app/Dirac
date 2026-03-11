"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn, SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import {
  Mail, Zap, Brain, Keyboard, ArrowRight,
  CheckCircle2, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────
type Step = "welcome" | "connect" | "shortcuts" | "done";
const STEPS: Step[] = ["welcome", "connect", "shortcuts", "done"];

// ─── Shared styles ────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh", background: "#080809",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,
  card: {
    width: "100%", maxWidth: 420,
    borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(20px)",
    padding: "32px 32px 28px",
    display: "flex", flexDirection: "column" as const, gap: 28,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 8,
  },
  logoIcon: {
    width: 26, height: 26, borderRadius: 7,
    background: "linear-gradient(135deg, rgba(124,58,237,0.7), rgba(59,130,246,0.7))",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 0 10px rgba(124,58,237,0.25)",
  } as React.CSSProperties,
  logoText: {
    fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)",
    letterSpacing: "-0.02em",
  },
  h1: {
    fontSize: 22, fontWeight: 750, letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.92)", margin: 0,
  },
  body: {
    fontSize: 13.5, color: "rgba(255,255,255,0.4)",
    lineHeight: 1.65, margin: 0,
  },
  primaryBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    width: "100%", padding: "11px 0", borderRadius: 9,
    background: "#fff", color: "#0a0a0b",
    fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em",
    border: "none", cursor: "pointer", transition: "opacity 0.15s",
  } as React.CSSProperties,
  ghostBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "100%", padding: "9px 0", borderRadius: 9,
    background: "transparent", color: "rgba(255,255,255,0.3)",
    fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
    transition: "color 0.15s",
  } as React.CSSProperties,
};

// ─── Step indicator ───────────────────────────────────────
function Steps({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const visible = STEPS.filter(s => s !== "done");
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
      {visible.map((s, i) => (
        <div key={s} style={{
          height: 3, borderRadius: 999,
          width: i <= idx ? 24 : 12,
          background: i <= idx ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.1)",
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: "0 auto 20px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.25))",
          border: "1px solid rgba(124,58,237,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Mail size={22} color="rgba(167,139,250,0.9)" />
        </div>
        <h1 style={S.h1}>Welcome to Dirac</h1>
        <p style={{ ...S.body, marginTop: 10, maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
          A unified inbox with AI built in — not bolted on.
          Bring your Gmail and Outlook into one place.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { icon: Zap,      label: "AI triage",    desc: "Auto-prioritize" },
          { icon: Brain,    label: "Smart replies", desc: "Draft in your voice" },
          { icon: Keyboard, label: "Keyboard-first",desc: "Full shortcuts" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} style={{
            borderRadius: 10, padding: "14px 10px",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <Icon size={16} color="rgba(167,139,250,0.7)" strokeWidth={1.75} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 650, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <button style={S.primaryBtn} onClick={onNext} onMouseOver={e => (e.currentTarget.style.opacity = "0.88")} onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
          Get started <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Connect ──────────────────────────────────────────────
function ConnectStep({ onNext, gmailAlreadyConnected }: { onNext: () => void; gmailAlreadyConnected: boolean }) {
  const [gmailLoading, setGmailLoading]     = useState(false);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [gmailDone, setGmailDone]           = useState(gmailAlreadyConnected);

  const handleGmail = async () => {
    setGmailLoading(true);
    // Use step=connect so on return we land on connect step, not welcome
    await signIn("google", { callbackUrl: "/onboarding?step=connect" });
  };

  const handleOutlook = () => {
    setOutlookLoading(true);
    window.location.href = "/api/oauth/outlook?returnTo=/onboarding?step=connect";
  };

  const connectors = [
    {
      id: "gmail", label: "Gmail",
      desc: "Google Mail — read, reply, and send",
      loading: gmailLoading, connected: gmailDone,
      onConnect: handleGmail,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <path d="M2 8l10 7 10-7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: "outlook", label: "Outlook",
      desc: "Microsoft 365, Outlook.com, Hotmail",
      loading: outlookLoading, connected: false,
      onConnect: handleOutlook,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
          <path d="M22 7l-10 7L2 7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={S.h1}>Connect your inbox</h1>
        <p style={{ ...S.body, marginTop: 8 }}>
          Add at least one account. You can add more later in Settings.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {connectors.map(c => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: 10,
            background: c.connected ? "rgba(124,58,237,0.07)" : "rgba(255,255,255,0.03)",
            border: c.connected ? "1px solid rgba(124,58,237,0.25)" : "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {c.icon}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>{c.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{c.desc}</div>
              </div>
            </div>
            {c.connected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#34d399" }}>
                <CheckCircle2 size={14} color="#34d399" /> Connected
              </div>
            ) : (
              <button
                onClick={c.onConnect}
                disabled={c.loading || gmailLoading || outlookLoading}
                style={{
                  padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)",
                  fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
                  opacity: (gmailLoading || outlookLoading) ? 0.5 : 1, transition: "opacity 0.15s",
                }}>
                {c.loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Connect"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          style={{ ...S.primaryBtn, opacity: gmailDone ? 1 : 0.4, cursor: gmailDone ? "pointer" : "not-allowed" }}
          onClick={onNext}
          disabled={!gmailDone}
          onMouseOver={e => gmailDone && (e.currentTarget.style.opacity = "0.88")}
          onMouseOut={e => gmailDone && (e.currentTarget.style.opacity = "1")}>
          Continue <ArrowRight size={14} />
        </button>
        <button style={S.ghostBtn} onClick={onNext}
          onMouseOver={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
          onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Shortcuts ────────────────────────────────────────────
const SHORTCUTS = [
  { keys: ["J", "K"], desc: "Navigate threads" },
  { keys: ["C"],      desc: "Compose new email" },
  { keys: ["E"],      desc: "Archive thread" },
  { keys: ["S"],      desc: "Star / unstar" },
  { keys: ["U"],      desc: "Toggle read / unread" },
  { keys: ["R"],      desc: "Open AI sidebar" },
  { keys: ["⌘", "L"], desc: "Toggle AI sidebar" },
  { keys: ["?"],      desc: "Show all shortcuts" },
];

function ShortcutsStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={S.h1}>Keyboard shortcuts</h1>
        <p style={{ ...S.body, marginTop: 8 }}>Dirac is built for speed. No mouse needed.</p>
      </div>

      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        {SHORTCUTS.map(({ keys, desc }, i) => (
          <div key={desc} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 14px",
            borderBottom: i < SHORTCUTS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
          }}>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>{desc}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {keys.map((k, j) => (
                <span key={j} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <kbd style={{
                    padding: "2px 7px", borderRadius: 5, fontSize: 11,
                    fontFamily: "monospace", fontWeight: 600,
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}>{k}</kbd>
                  {j < keys.length - 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>then</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button style={S.primaryBtn} onClick={onNext}
        onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
        Take me to my inbox <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── Done ─────────────────────────────────────────────────
function DoneStep() {
  const router = useRouter();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 20 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <CheckCircle2 size={24} color="#34d399" />
      </div>
      <div>
        <h1 style={S.h1}>You&apos;re all set</h1>
        <p style={{ ...S.body, marginTop: 8 }}>Your inbox is syncing. Let Dirac sort things out.</p>
      </div>
      <button style={{ ...S.primaryBtn }}
        onClick={() => router.push("/inbox")}
        onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
        Open inbox <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── Inner page (needs Suspense for useSearchParams) ──────
function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Determine initial step — if returning from Google OAuth, land on connect
  const paramStep = searchParams.get("step") as Step | null;
  const [step, setStep] = useState<Step>(paramStep ?? "welcome");

  // If session loaded and already past welcome, mark gmail as connected
  const gmailConnected = session?.gmailConnected ?? false;

  // If fully connected and no explicit step, skip to inbox
  useEffect(() => {
    if (status === "loading") return;
    if (gmailConnected && !paramStep) {
      router.replace("/inbox");
    }
  }, [status, gmailConnected, paramStep, router]);

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  if (status === "loading") {
    return (
      <div style={{ ...S.page }}>
        <Loader2 size={20} color="rgba(255,255,255,0.3)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* bg glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.1) 0%, transparent 60%)" }} />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logo}>
          <div style={S.logoIcon}><Mail size={13} color="#fff" /></div>
          <span style={S.logoText}>Dirac</span>
        </div>

        {/* Step */}
        {step === "welcome"   && <WelcomeStep onNext={next} />}
        {step === "connect"   && <ConnectStep onNext={next} gmailAlreadyConnected={gmailConnected} />}
        {step === "shortcuts" && <ShortcutsStep onNext={next} />}
        {step === "done"      && <DoneStep />}

        {/* Progress */}
        {step !== "done" && <Steps current={step} />}
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────
export default function OnboardingPage() {
  return (
    <SessionProvider>
      <Suspense fallback={
        <div style={{ minHeight: "100vh", background: "#080809", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={20} color="rgba(255,255,255,0.3)" style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <OnboardingInner />
      </Suspense>
    </SessionProvider>
  );
}
