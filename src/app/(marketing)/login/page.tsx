"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Mail, Loader2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M11.4 11.4H2V2h9.4v9.4z" fill="#F25022"/>
      <path d="M22 11.4h-9.4V2H22v9.4z" fill="#7FBA00"/>
      <path d="M11.4 22H2v-9.4h9.4V22z" fill="#00A4EF"/>
      <path d="M22 22h-9.4v-9.4H22V22z" fill="#FFB900"/>
    </svg>
  );
}

export default function LoginPage() {
  const [googleLoading, setGoogleLoading]     = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/onboarding" });
  };

  const handleMicrosoft = () => {
    setMicrosoftLoading(true);
    window.location.href = "/api/oauth/outlook?returnTo=/onboarding";
  };

  const busy = googleLoading || microsoftLoading;

  const btnBase: React.CSSProperties = {
    display: "flex", width: "100%", alignItems: "center", justifyContent: "center",
    gap: 10, padding: "10px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 500,
    cursor: busy ? "not-allowed" : "pointer", transition: "opacity 0.15s",
    border: "none", outline: "none",
    opacity: busy ? 0.5 : 1,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* bg glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 11, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 14 }}>
            <Mail size={18} color="rgba(255,255,255,0.85)" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 650, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Sign in to Dirac
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            Connect your inbox to get started
          </div>
        </div>

        {/* Card */}
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleGoogle}
            disabled={busy}
            style={{ ...btnBase, background: "#fff", color: "#1a1a1a" }}
          >
            {googleLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <GoogleIcon />}
            Continue with Google
          </button>

          <button
            onClick={handleMicrosoft}
            disabled={busy}
            style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {microsoftLoading ? <Loader2 size={15} color="rgba(255,255,255,0.5)" style={{ animation: "spin 1s linear infinite" }} /> : <MicrosoftIcon />}
            Continue with Microsoft
          </button>

          <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.25)", lineHeight: 1.6, margin: 0 }}>
              By continuing you agree to Dirac&apos;s{" "}
              <Link href="/terms"   style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Privacy Policy</Link>.
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
          <Link href="/home" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>← Back to dirac.app</Link>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
