import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "Settings & API Keys — Dirac Docs" };

export default function SettingsPage() {
  return (
    <DocLayout title="Settings & API Keys">
      <Section title="AI model">
        <P>
          In Settings → AI, choose any model available on{" "}
          <a href="https://openrouter.ai/models" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.6)", textUnderlineOffset: 3 }}>
            OpenRouter
          </a>
          . Paste the model ID (e.g. <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>anthropic/claude-3.5-sonnet</code>) into
          the model field.
        </P>
        <P>
          The default model is <code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>google/gemini-2.0-flash-001</code> — fast,
          cheap, and capable for most email tasks.
        </P>
      </Section>

      <Section title="Bring your own API key">
        <P>
          Dirac includes a shared OpenRouter key for all users. If you hit rate limits or want to use a
          specific model, add your own key:
        </P>
        <Ul>
          <Li>Go to Settings → AI.</Li>
          <Li>Paste your OpenRouter API key.</Li>
          <Li>Save — all AI requests will now use your key and your OpenRouter account balance.</Li>
        </Ul>
        <Callout>
          Your API key is stored encrypted in the database and is never returned in API responses.
          You can remove it at any time to revert to the shared key.
        </Callout>
      </Section>

      <Section title="Tone profile">
        <P>
          Dirac analyzes your recent sent emails to build a writing style profile. To regenerate it after
          you&apos;ve sent more emails, go to Settings → AI → Regenerate tone profile.
        </P>
      </Section>

      <Section title="About me">
        <P>
          The &quot;About me&quot; field in Settings → AI lets you provide context about yourself —
          your role, company, or communication preferences. This is injected into every AI prompt.
        </P>
        <P>Example: &quot;I&apos;m a founder at a B2B SaaS startup. Keep replies brief and direct.&quot;</P>
      </Section>

      <Section title="Appearance">
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Theme</strong> — Light or dark mode. Toggle with the command palette or ⌘K → &quot;theme&quot;.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Density</strong> — Compact or comfortable thread list spacing.</Li>
        </Ul>
      </Section>

      <Section title="Connected accounts">
        <P>
          View and manage your connected Gmail, Outlook, and Discord accounts in Settings → Integrations.
          Disconnecting an account removes its threads from the inbox immediately.
        </P>
      </Section>
    </DocLayout>
  );
}
