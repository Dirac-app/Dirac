import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "Self-Hosting — Dirac Docs" };

const CODE: React.CSSProperties = {
  display: "block",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontFamily: "monospace",
  fontSize: 12,
  color: "rgba(255,255,255,0.65)",
  lineHeight: 1.75,
  whiteSpace: "pre",
  overflowX: "auto",
  marginBottom: 16,
};

export default function SelfHostingPage() {
  return (
    <DocLayout title="Self-Hosting">
      <Section title="Overview">
        <P>
          Dirac is open source and fully self-hostable. You can run your own instance on any platform
          that supports Node.js — Railway, Vercel, Render, Fly.io, or a plain VPS. You own your data
          and your API keys.
        </P>
        <Callout>
          The source code is available on{" "}
          <a href="https://github.com/your-org/dirac" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.55)", textUnderlineOffset: 3 }}>
            GitHub
          </a>
          . Pull requests and issues are welcome.
        </Callout>
      </Section>

      <Section title="Prerequisites">
        <Ul>
          <Li>Node.js 20+</Li>
          <Li>PostgreSQL database (Supabase, Neon, Railway, or self-hosted)</Li>
          <Li>Google OAuth app (for Gmail sign-in)</Li>
          <Li>Microsoft Azure app registration (for Outlook sign-in)</Li>
          <Li>OpenRouter API key (optional — for AI features)</Li>
          <Li>Discord bot token (optional — for Discord integration)</Li>
        </Ul>
      </Section>

      <Section title="1. Clone the repo">
        <code style={CODE}>{`git clone https://github.com/your-org/dirac.git
cd dirac
npm install`}</code>
      </Section>

      <Section title="2. Configure environment variables">
        <P>Copy the example env file and fill in your values:</P>
        <code style={CODE}>{`cp .env.example .env.local`}</code>
        <P>Required variables:</P>
        <code style={CODE}>{`# Auth
NEXTAUTH_SECRET=your-random-secret-here     # openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com

# Google OAuth (for Gmail)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OAuth (for Outlook)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dirac

# Supabase (if using Supabase as DB host)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# AI (optional — users can add their own key in Settings)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.0-flash-001`}</code>
      </Section>

      <Section title="3. Set up the database">
        <code style={CODE}>{`npx prisma migrate deploy
npx prisma generate`}</code>
      </Section>

      <Section title="4. Run the app">
        <P>Development:</P>
        <code style={CODE}>{`npm run dev`}</code>
        <P>Production build:</P>
        <code style={CODE}>{`npm run build
npm run start`}</code>
      </Section>

      <Section title="5. Set up OAuth apps">
        <P><strong style={{ color: "rgba(255,255,255,0.7)" }}>Google</strong></P>
        <Ul>
          <Li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>Google Cloud Console</a> → APIs &amp; Services → Credentials.</Li>
          <Li>Create an OAuth 2.0 Client ID (Web application).</Li>
          <Li>Add authorized redirect URI: <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>https://your-domain.com/api/auth/callback/google</code></Li>
          <Li>Enable the Gmail API in your project.</Li>
        </Ul>
        <P style={{ marginTop: 16 }}><strong style={{ color: "rgba(255,255,255,0.7)" }}>Microsoft</strong></P>
        <Ul>
          <Li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>Azure Portal</a> → App registrations → New registration.</Li>
          <Li>Add redirect URI: <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>https://your-domain.com/api/oauth/outlook/callback</code></Li>
          <Li>Add API permissions: <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Mail.Read</code>, <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Mail.Send</code>, <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Mail.ReadWrite</code>, <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>offline_access</code></Li>
        </Ul>
      </Section>

      <Section title="Contributing">
        <P>
          We welcome contributions of all kinds — bug fixes, new integrations, UI improvements,
          and documentation. To get started:
        </P>
        <Ul>
          <Li>Fork the repo and create a feature branch.</Li>
          <Li>Run <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>npm run dev</code> and make your changes.</Li>
          <Li>Open a pull request with a clear description of what you changed and why.</Li>
        </Ul>
        <P>
          For larger changes, open an issue first to discuss the approach. Check the{" "}
          <a href="https://github.com/your-org/dirac/issues" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>
            issue tracker
          </a>{" "}
          for things that need help.
        </P>
      </Section>

      <Section title="License">
        <P>
          Dirac is released under the{" "}
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>
            MIT License
          </a>
          . You are free to use, modify, and distribute it — including for commercial purposes.
        </P>
      </Section>
    </DocLayout>
  );
}
