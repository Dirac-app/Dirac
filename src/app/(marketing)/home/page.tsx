"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Mail, Zap, Brain, Keyboard, Shield, RefreshCw, MessageSquare } from "lucide-react";

const FEATURES = [
  { icon: Zap,           title: "AI triage",            desc: "Urgency scoring and smart categorization so the right emails surface first." },
  { icon: Brain,         title: "Replies in your voice", desc: "Learns your writing style. Drafts that actually sound like you wrote them." },
  { icon: Keyboard,      title: "Keyboard-first",        desc: "j/k, e, s, r — every action has a shortcut. Never touch your mouse." },
  { icon: MessageSquare, title: "Unified inbox",         desc: "Gmail and Outlook in one place. One interface, one workflow." },
  { icon: RefreshCw,     title: "Real-time sync",        desc: "Your inbox stays current. New messages appear instantly." },
  { icon: Shield,        title: "Privacy first",         desc: "Tokens encrypted at rest. Email content never stored on our servers." },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#080809", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        .fade-up-1 { animation: fadeUp 0.6s ease forwards; animation-delay: 0.05s; opacity: 0; }
        .fade-up-2 { animation: fadeUp 0.6s ease forwards; animation-delay: 0.15s; opacity: 0; }
        .fade-up-3 { animation: fadeUp 0.6s ease forwards; animation-delay: 0.25s; opacity: 0; }
        .fade-up-4 { animation: fadeUp 0.6s ease forwards; animation-delay: 0.35s; opacity: 0; }
        .fade-up-5 { animation: fadeUp 0.7s ease forwards; animation-delay: 0.45s; opacity: 0; }
        .window-float { animation: float 6s ease-in-out infinite; }
        .feature-card:hover { background: rgba(255,255,255,0.045) !important; border-color: rgba(255,255,255,0.1) !important; transform: translateY(-1px); }
        .feature-card { transition: all 0.2s ease; }
        .cta-primary:hover { background: rgba(255,255,255,0.92) !important; }
        .cta-secondary:hover { background: rgba(255,255,255,0.08) !important; }
        .nav-link:hover { color: rgba(255,255,255,0.7) !important; }
        .sign-in-btn:hover { background: rgba(255,255,255,0.12) !important; }
      `}</style>

      {/* === BACKGROUND LAYERS === */}

      {/* dot grid */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "32px 32px" }} />

      {/* animated top glow — purple + blue split */}
      <div style={{ position: "fixed", top: -120, left: "50%", transform: "translateX(-50%)",
        width: 1100, height: 600, pointerEvents: "none", zIndex: 0,
        animation: "pulse-glow 5s ease-in-out infinite",
        background: "radial-gradient(ellipse at 35% 50%, rgba(124,58,237,0.18) 0%, transparent 50%), radial-gradient(ellipse at 65% 50%, rgba(59,130,246,0.13) 0%, transparent 50%)" }} />

      {/* bottom vignette */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 300, pointerEvents: "none", zIndex: 0,
        background: "linear-gradient(to top, rgba(8,8,9,0.8) 0%, transparent 100%)" }} />

      {/* === NAV === */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,8,9,0.85)", backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, rgba(124,58,237,0.6), rgba(59,130,246,0.6))",
              border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 0 12px rgba(124,58,237,0.3)" }}>
              <Mail size={13} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Dirac</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/privacy" className="nav-link" style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", textDecoration: "none", transition: "color 0.15s" }}>Privacy</Link>
            <Link href="/terms"   className="nav-link" style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", textDecoration: "none", transition: "color 0.15s" }}>Terms</Link>
            <Link href="/login"   className="sign-in-btn" style={{ fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none",
              padding: "6px 16px", borderRadius: 8,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
              transition: "background 0.15s", letterSpacing: "-0.01em" }}>
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* === HERO === */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 1080, margin: "0 auto", padding: "88px 28px 72px", textAlign: "center" }}>

        {/* badge */}
        <div className="fade-up-1" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 999,
          background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block",
            boxShadow: "0 0 6px rgba(167,139,250,0.8)", animation: "pulse-glow 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 12, color: "rgba(196,181,253,0.9)", fontWeight: 500, letterSpacing: "0.01em" }}>AI-powered unified inbox</span>
        </div>

        {/* headline */}
        <h1 className="fade-up-2" style={{ fontSize: "clamp(48px, 7vw, 76px)", fontWeight: 800, letterSpacing: "-0.04em",
          lineHeight: 1.05, margin: "0 0 22px",
          background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          Cursor for your<br />
          <span style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            messages
          </span>
        </h1>

        {/* subheading */}
        <p className="fade-up-3" style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", lineHeight: 1.65,
          maxWidth: 460, margin: "0 auto 36px", letterSpacing: "-0.01em" }}>
          Dirac unifies Gmail and Outlook into one inbox.
          AI triages what matters, drafts replies in your voice, and stays out of your way.
        </p>

        {/* CTAs */}
        <div className="fade-up-4" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 64 }}>
          <Link href="/login" className="cta-primary" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "11px 22px", borderRadius: 10,
            background: "#fff", color: "#0a0a0b",
            fontSize: 14, fontWeight: 700, textDecoration: "none", letterSpacing: "-0.02em",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 4px 24px rgba(255,255,255,0.08)",
            transition: "background 0.15s" }}>
            Sign in <ArrowRight size={14} />
          </Link>
          <a href="#features" className="cta-secondary" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 22px", borderRadius: 10,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 500,
            textDecoration: "none", letterSpacing: "-0.01em", transition: "background 0.15s" }}>
            See how it works
          </a>
        </div>

        {/* === MOCK APP WINDOW === */}
        <div className="fade-up-5 window-float" style={{
          borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(14,14,16,0.9)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.08)",
          backdropFilter: "blur(10px)" }}>

          {/* window chrome */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "11px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", gap: 6, marginRight: 14 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd2e" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
            </div>
            <div style={{ padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
              fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.01em" }}>
              dirac.app/inbox
            </div>
          </div>

          {/* app layout */}
          <div style={{ display: "flex", height: 280, textAlign: "left" }}>

            {/* icon nav */}
            <div style={{ width: 52, borderRight: "1px solid rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, marginBottom: 8,
                background: "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(59,130,246,0.5))",
                border: "1px solid rgba(255,255,255,0.1)" }} />
              {[true, false, false, false].map((active, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: 7,
                  background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: active ? "1px solid rgba(255,255,255,0.1)" : "none" }} />
              ))}
            </div>

            {/* thread list */}
            <div style={{ width: 248, borderRight: "1px solid rgba(255,255,255,0.05)", overflowY: "hidden" }}>
              {/* filter chips */}
              <div style={{ display: "flex", gap: 5, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {[60, 45, 55].map((w, i) => (
                  <div key={i} style={{ height: 18, borderRadius: 999, width: w,
                    background: i === 0 ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
                    border: i === 0 ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(255,255,255,0.06)" }} />
                ))}
              </div>
              {[
                { w1: 70, w2: 55, unread: true,  urgent: true  },
                { w1: 80, w2: 65, unread: true,  urgent: false },
                { w1: 60, w2: 75, unread: false, urgent: false },
                { w1: 75, w2: 50, unread: false, urgent: false },
                { w1: 65, w2: 70, unread: false, urgent: false },
              ].map(({ w1, w2, unread, urgent }, i) => (
                <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: i === 0 ? "rgba(124,58,237,0.08)" : "transparent",
                  position: "relative" }}>
                  {i === 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
                    background: "linear-gradient(to bottom, #7c3aed, #3b82f6)", borderRadius: "0 2px 2px 0" }} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ width: `${w1}%`, height: 7, borderRadius: 3,
                      background: unread ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)" }} />
                    <div style={{ display: "flex", gap: 4 }}>
                      {urgent && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />}
                      {unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed" }} />}
                    </div>
                  </div>
                  <div style={{ width: `${w2}%`, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)" }} />
                </div>
              ))}
            </div>

            {/* thread view */}
            <div style={{ flex: 1, padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: "35%", height: 9, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
                <div style={{ marginLeft: "auto", width: 50, height: 20, borderRadius: 5,
                  background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }} />
              </div>
              {[100, 90, 78, 88, 55, 72, 82, 60].map((w, i) => (
                <div key={i} style={{ width: `${w}%`, height: 6, borderRadius: 3,
                  background: `rgba(255,255,255,${i < 2 ? 0.07 : 0.035})`, marginBottom: 8 }} />
              ))}
              <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 8,
                background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.18)" }}>
                {[80, 65, 90].map((w, i) => (
                  <div key={i} style={{ width: `${w}%`, height: 5, borderRadius: 3,
                    background: "rgba(167,139,250,0.2)", marginBottom: i < 2 ? 7 : 0 }} />
                ))}
              </div>
            </div>

            {/* AI sidebar */}
            <div style={{ width: 170, borderLeft: "1px solid rgba(255,255,255,0.05)", padding: "14px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4,
                  background: "linear-gradient(135deg, rgba(124,58,237,0.6), rgba(59,130,246,0.6))" }} />
                <div style={{ width: "60%", height: 6, borderRadius: 3, background: "rgba(167,139,250,0.3)" }} />
              </div>
              {[85, 70, 90, 60, 75, 50].map((w, i) => (
                <div key={i} style={{ width: `${w}%`, height: 5, borderRadius: 3,
                  background: "rgba(255,255,255,0.05)", marginBottom: 7 }} />
              ))}
              <div style={{ marginTop: 10, width: "100%", height: 22, borderRadius: 6,
                background: "linear-gradient(90deg, rgba(124,58,237,0.25), rgba(59,130,246,0.25))",
                border: "1px solid rgba(124,58,237,0.3)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section id="features" style={{ position: "relative", zIndex: 10,
        borderTop: "1px solid rgba(255,255,255,0.06)", padding: "72px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 750, letterSpacing: "-0.03em",
              color: "rgba(255,255,255,0.9)", margin: "0 0 10px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Everything your inbox is missing
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", margin: 0, letterSpacing: "-0.01em" }}>
              Built for people who live in their messages
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 10 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card" style={{ borderRadius: 12, padding: "22px",
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, marginBottom: 16,
                  background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color="rgba(167,139,250,0.85)" strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: "rgba(255,255,255,0.85)",
                  marginBottom: 7, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA SECTION === */}
      <section style={{ position: "relative", zIndex: 10, padding: "80px 28px", textAlign: "center", overflow: "hidden" }}>
        {/* glow behind CTA */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 600, height: 300, pointerEvents: "none",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto",
          padding: 40, borderRadius: 20,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 0 60px rgba(124,58,237,0.08)" }}>
          <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em",
            color: "rgba(255,255,255,0.92)", marginBottom: 10,
            background: "linear-gradient(135deg, #fff 30%, rgba(167,139,250,0.8) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Ready to move faster?
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.6 }}>
            Connect your inbox in under 2 minutes.<br />No credit card required.
          </p>
          <Link href="/login" className="cta-primary" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 10,
            background: "#fff", color: "#0a0a0b",
            fontSize: 14, fontWeight: 700, textDecoration: "none", letterSpacing: "-0.02em",
            boxShadow: "0 0 30px rgba(255,255,255,0.1)",
            transition: "background 0.15s" }}>
            Get started free <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 28px",
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(59,130,246,0.4))",
              border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={11} color="rgba(255,255,255,0.7)" />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>Dirac</span>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/privacy" className="nav-link" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color 0.15s" }}>Privacy Policy</Link>
            <Link href="/terms"   className="nav-link" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color 0.15s" }}>Terms of Service</Link>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", margin: 0 }}>
            © {new Date().getFullYear()} Dirac. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
