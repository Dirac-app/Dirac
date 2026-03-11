import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata = { title: "Privacy Policy — Dirac" };

const NAV_STYLE: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  position: "sticky", top: 0, zIndex: 10,
  background: "rgba(12,12,14,0.9)", backdropFilter: "blur(10px)",
};

const PROSE: React.CSSProperties = {
  fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.75,
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0e", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <nav style={NAV_STYLE}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52 }}>
          <Link href="/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={12} color="#fff" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Dirac</span>
          </Link>
          <Link href="/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Sign in →</Link>
        </div>
      </nav>

      <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.9)", margin: "0 0 8px" }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {[
            {
              title: "1. Overview",
              body: `Dirac ("we," "us," or "our") provides a unified communications workspace at dirac.app. This Privacy Policy explains how we collect, use, and protect your information. We do not sell your personal data or email content to third parties, and we store only what is necessary to provide the service.`,
            },
            {
              title: "2. Information We Collect",
              items: [
                { label: "Account information", text: "When you sign in with Google or Microsoft, we receive your name, email address, and profile picture. We store this to identify your account." },
                { label: "OAuth tokens", text: "To access your email on your behalf, we store OAuth access and refresh tokens. Refresh tokens are encrypted at rest using AES-256." },
                { label: "Email metadata", text: "We store thread metadata (sender, subject, timestamp, read status) to power the unified inbox. Full email body content is fetched on demand from Gmail/Outlook APIs and is not stored on our servers." },
                { label: "Usage data", text: "We may collect anonymized usage analytics (pages visited, features used) to improve the product." },
              ],
            },
            {
              title: "3. How We Use Your Information",
              list: [
                "To authenticate you and maintain your session",
                "To fetch and display your emails and messages",
                "To send emails on your behalf when you use the compose feature",
                "To provide AI-powered features — email content is sent to your configured AI provider only when you explicitly trigger these features",
                "To improve the product through anonymized usage analytics",
              ],
            },
            {
              title: "4. AI Features and Your API Key",
              body: `Dirac uses a bring-your-own-key (BYOK) model via OpenRouter. When you use AI features like triage, urgency scoring, or reply drafting, the relevant email content is sent directly to OpenRouter using your own API key. We do not proxy or store this content — it goes from your browser to your AI provider. You are responsible for reviewing OpenRouter's privacy policy at openrouter.ai. AI features are entirely opt-in and you control when your email content is processed.`,
            },
            {
              title: "5. Data Storage and Security",
              body: `Your account and metadata are stored in a PostgreSQL database hosted on Supabase infrastructure. We use TLS for all connections, AES-256 encryption for OAuth tokens at rest, and strict access controls. Full email body content is never stored on our servers.`,
            },
            {
              title: "6. Data Sharing",
              body: "We do not sell your personal data. We share data only with:",
              list: [
                "Google / Microsoft — to authenticate you and access your email via their official APIs",
                "OpenRouter — only the email content you explicitly submit to AI features, using your own API key",
                "Supabase — our database provider for account and metadata storage",
                "Vercel — our hosting provider",
              ],
            },
            {
              title: "7. Your Rights",
              body: "You can at any time:",
              list: [
                "Disconnect your Google or Microsoft account from Dirac in Settings",
                "Request deletion of your account and all associated data by contacting us",
                "Revoke Dirac's access to your Google account at myaccount.google.com/permissions",
                "Revoke Dirac's access to your Microsoft account at account.microsoft.com",
              ],
            },
            {
              title: "8. Children's Privacy",
              body: `Dirac is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.`,
            },
            {
              title: "9. Changes to This Policy",
              body: `We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice in the app or emailing your registered address.`,
            },
            {
              title: "10. Contact",
              body: null,
              contact: "privacy@dirac.app",
            },
          ].map((section) => (
            <section key={section.title}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em", margin: "0 0 10px" }}>
                {section.title}
              </h2>
              {"body" in section && section.body && (
                <p style={{ ...PROSE, margin: "0 0 10px" }}>{section.body}</p>
              )}
              {"items" in section && section.items && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {section.items.map((item) => (
                    <div key={item.label}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{item.label}: </span>
                      <span style={PROSE}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {"list" in section && section.list && (
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.list.map((item) => (
                    <li key={item} style={PROSE}>{item}</li>
                  ))}
                </ul>
              )}
              {"contact" in section && section.contact && (
                <p style={{ ...PROSE, margin: 0 }}>
                  Questions about this Privacy Policy? Contact us at{" "}
                  <a href={`mailto:${section.contact}`} style={{ color: "rgba(165,168,255,0.7)", textDecoration: "underline" }}>
                    {section.contact}
                  </a>.
                </p>
              )}
            </section>
          ))}
        </div>
      </article>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between" }}>
          <Link href="/home"  style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>← Back to home</Link>
          <Link href="/terms" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
