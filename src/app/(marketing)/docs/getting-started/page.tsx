import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "Getting Started — Dirac Docs" };

export default function GettingStartedPage() {
  return (
    <DocLayout title="Getting Started">
      <Section title="What is Dirac?">
        <P>
          Dirac is a unified inbox that brings Gmail, Outlook, and Discord into one fast, keyboard-driven interface.
          AI is built directly into the workflow — not bolted on — so you can triage, understand, and reply to
          messages without switching context.
        </P>
      </Section>

      <Section title="1. Create your account">
        <P>
          Sign in with Google (for Gmail) or Microsoft (for Outlook) at{" "}
          <a href="/login" style={{ color: "rgba(255,255,255,0.6)", textUnderlineOffset: 3 }}>dirac.app/login</a>.
          Your sign-in provider becomes your primary email account.
        </P>
        <Callout>
          Dirac uses OAuth — we never see or store your password.
        </Callout>
      </Section>

      <Section title="2. Connect your inbox">
        <P>After signing in, the onboarding flow will guide you through connecting your inbox:</P>
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Gmail</strong> — Connected automatically when you sign in with Google.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Outlook</strong> — Connected automatically when you sign in with Microsoft.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Discord</strong> — Connect via the onboarding screen or Settings → Integrations. Requires a Discord account.</Li>
        </Ul>
      </Section>

      <Section title="3. Learn the basics">
        <P>Once your inbox loads:</P>
        <Ul>
          <Li>Use <strong style={{ color: "rgba(255,255,255,0.65)" }}>J / K</strong> to navigate between threads.</Li>
          <Li>Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>R</strong> to open the AI sidebar for the selected thread.</Li>
          <Li>Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>C</strong> to compose a new message.</Li>
          <Li>Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>?</strong> anytime to see all shortcuts.</Li>
        </Ul>
      </Section>

      <Section title="4. Set up AI (optional)">
        <P>
          Dirac includes a shared AI key so you can use AI features immediately. For higher limits or model choice,
          add your own <a href="https://openrouter.ai" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.6)", textUnderlineOffset: 3 }}>OpenRouter</a> API
          key in Settings.
        </P>
      </Section>
    </DocLayout>
  );
}
