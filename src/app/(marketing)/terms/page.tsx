import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata = { title: "Terms of Service — Dirac" };

const NAV_STYLE: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  position: "sticky", top: 0, zIndex: 10,
  background: "rgba(12,12,14,0.9)", backdropFilter: "blur(10px)",
};

const PROSE: React.CSSProperties = {
  fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, margin: 0,
};

export default function TermsPage() {
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
          <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.9)", margin: "0 0 8px" }}>Terms of Service</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {[
            { title: "1. Acceptance", body: `By accessing or using Dirac at dirac.app, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.` },
            { title: "2. Description of Service", body: `Dirac is a unified communications workspace that connects to your Gmail and Outlook accounts and provides a consolidated inbox with optional AI-powered features.` },
            { title: "3. Account Registration", body: `You must sign in using a valid Google or Microsoft account. You are responsible for all activity that occurs under your account and must notify us immediately of any unauthorized use.` },
            {
              title: "4. Acceptable Use",
              body: "You agree not to use the Service to:",
              list: [
                "Send spam, unsolicited messages, or bulk commercial email",
                "Violate any applicable law or regulation",
                "Transmit harmful, offensive, or illegal content",
                "Attempt unauthorized access to other accounts or systems",
                "Interfere with or disrupt the Service or its infrastructure",
                "Harass, abuse, or harm others",
              ],
            },
            { title: "5. Third-Party Services", body: `Dirac integrates with Google Gmail API and Microsoft Graph API. Your use of these integrations is subject to Google's and Microsoft's respective terms. We are not responsible for the availability or functionality of third-party services.` },
            { title: "6. AI Features and BYOK", body: `Dirac's AI features operate on a bring-your-own-key (BYOK) basis via OpenRouter. You provide your own API key and are responsible for any costs incurred. AI-generated content is provided as a suggestion only — you are solely responsible for reviewing content before sending. We make no guarantees about accuracy or appropriateness of AI suggestions.` },
            { title: "7. Intellectual Property", body: `The Dirac name, logo, and application are owned by Dirac and its creators. You retain full ownership of all content in your email accounts — we claim no rights over your messages.` },
            { title: "8. Disclaimer of Warranties", body: `The Service is provided "as is" without warranties of any kind. We do not warrant that the Service will be uninterrupted, error-free, or completely secure. Early access users acknowledge the Service may have incomplete features or bugs.` },
            { title: "9. Limitation of Liability", body: `To the maximum extent permitted by law, Dirac and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to loss of data, lost profits, or business interruption.` },
            { title: "10. Termination", body: `You may stop using the Service at any time by disconnecting your accounts in Settings. We reserve the right to suspend or terminate accounts that violate these Terms. Upon termination, your data will be deleted in accordance with our Privacy Policy.` },
            { title: "11. Changes to Terms", body: `We may update these Terms from time to time. Continued use after changes constitutes acceptance. We will provide notice of significant changes in the app.` },
            { title: "12. Contact", body: null, contact: "legal@dirac.app" },
          ].map((section) => (
            <section key={section.title}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em", margin: "0 0 8px" }}>
                {section.title}
              </h2>
              {"body" in section && section.body && (
                <p style={{ ...PROSE, marginBottom: "list" in section && section.list ? 10 : 0 }}>{section.body}</p>
              )}
              {"list" in section && section.list && (
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                  {section.list.map((item) => <li key={item} style={PROSE}>{item}</li>)}
                </ul>
              )}
              {"contact" in section && section.contact && (
                <p style={PROSE}>
                  Questions about these Terms? Contact us at{" "}
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
          <Link href="/home"    style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>← Back to home</Link>
          <Link href="/privacy" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
