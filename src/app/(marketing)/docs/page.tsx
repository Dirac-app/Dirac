"use client";

import Link from "next/link";
import { Mail, Inbox, Sparkles, Keyboard, Settings, Zap, MessageSquare, ArrowRight, Github } from "lucide-react";

const NAV_STYLE: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  position: "sticky", top: 0, zIndex: 10,
  background: "rgba(12,12,14,0.95)", backdropFilter: "blur(10px)",
};

const SECTIONS = [
  {
    icon: Zap,
    title: "Getting Started",
    slug: "getting-started",
    desc: "Connect your inbox and get up to speed in under 2 minutes.",
  },
  {
    icon: Inbox,
    title: "The Inbox",
    slug: "inbox",
    desc: "Triage, filter, and navigate your unified inbox.",
  },
  {
    icon: Sparkles,
    title: "AI Features",
    slug: "ai",
    desc: "Let AI draft replies, triage urgency, and surface insights.",
  },
  {
    icon: MessageSquare,
    title: "Integrations",
    slug: "integrations",
    desc: "Gmail, Outlook, and Discord — how each platform works.",
  },
  {
    icon: Keyboard,
    title: "Keyboard Shortcuts",
    slug: "shortcuts",
    desc: "Move at the speed of thought with power-user shortcuts.",
  },
  {
    icon: Settings,
    title: "Settings & API Keys",
    slug: "settings",
    desc: "Configure your AI model, tone profile, and personal API key.",
  },
  {
    icon: Github,
    title: "Self-Hosting",
    slug: "self-hosting",
    desc: "Run your own Dirac instance. Open source, MIT licensed.",
  },
];

export default function DocsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0e", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <nav style={NAV_STYLE}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52 }}>
          <Link href="/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={12} color="#fff" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Dirac</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", margin: "0 2px" }}>/</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Docs</span>
          </Link>
          <Link href="/inbox" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Open app →</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 80px" }}>
        <div style={{ marginBottom: 56 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 12px" }}>
            Documentation
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.6 }}>
            Everything you need to get the most out of Dirac.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {SECTIONS.map(({ icon: Icon, title, slug, desc }) => (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              style={{
                display: "flex", flexDirection: "column", gap: 12,
                padding: "20px 20px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, textDecoration: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.13)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color="rgba(255,255,255,0.7)" />
                </div>
                <ArrowRight size={13} color="rgba(255,255,255,0.2)" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 4px" }}>{title}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: "20px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Need help?{" "}
            <a href="mailto:support@dirac.app" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              support@dirac.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
