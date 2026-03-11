"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Zap, Inbox, Sparkles, MessageSquare, Keyboard, Settings, ChevronLeft, Github } from "lucide-react";

const NAV_LINKS = [
  { href: "/docs/getting-started", label: "Getting Started",    icon: Zap },
  { href: "/docs/inbox",           label: "The Inbox",          icon: Inbox },
  { href: "/docs/ai",              label: "AI Features",        icon: Sparkles },
  { href: "/docs/integrations",    label: "Integrations",       icon: MessageSquare },
  { href: "/docs/shortcuts",       label: "Keyboard Shortcuts", icon: Keyboard },
  { href: "/docs/settings",        label: "Settings & API Keys",icon: Settings },
  { href: "/docs/self-hosting",    label: "Self-Hosting",       icon: Github },
];

const NAV_STYLE: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  position: "sticky", top: 0, zIndex: 10,
  background: "rgba(12,12,14,0.95)", backdropFilter: "blur(10px)",
};

export function DocLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0e", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <nav style={NAV_STYLE}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52 }}>
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", gap: 48, alignItems: "flex-start" }}>
        {/* Sidebar */}
        <aside style={{ width: 200, flexShrink: 0, position: "sticky", top: 72, paddingTop: 40, paddingBottom: 40 }}>
          <Link href="/docs" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", marginBottom: 24 }}>
            <ChevronLeft size={12} /> All docs
          </Link>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px", borderRadius: 6,
                    fontSize: 13, textDecoration: "none",
                    color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    background: active ? "rgba(255,255,255,0.07)" : "transparent",
                    fontWeight: active ? 500 : 400,
                    transition: "color 0.1s, background 0.1s",
                  }}
                >
                  <Icon size={13} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, paddingTop: 40, paddingBottom: 80 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", color: "rgba(255,255,255,0.92)", margin: "0 0 32px" }}>
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Prose helpers ── */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, color: "rgba(255,255,255,0.8)", margin: "0 0 12px", letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, margin: "0 0 12px" }}>{children}</p>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>{children}</ul>;
}

export function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{children}</li>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: string }) {
  return (
    <kbd style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
      {children}
    </kbd>
  );
}

export function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{desc}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {keys.map((k, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Kbd>{k}</Kbd>
            {i < keys.length - 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>then</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
