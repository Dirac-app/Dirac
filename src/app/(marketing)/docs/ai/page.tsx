import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "AI Features — Dirac Docs" };

export default function AiPage() {
  return (
    <DocLayout title="AI Features">
      <Section title="Overview">
        <P>
          Dirac&apos;s AI sidebar is powered by{" "}
          <a href="https://openrouter.ai" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.6)", textUnderlineOffset: 3 }}>OpenRouter</a>,
          giving you access to models like Gemini 2.0 Flash, GPT-4o, Claude, and more. AI runs
          in streaming mode — responses appear word-by-word, never making you wait for a full generation.
        </P>
      </Section>

      <Section title="Opening the AI sidebar">
        <Ul>
          <Li>Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>R</strong> with a thread selected to open AI with that thread in context.</Li>
          <Li>Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>⌘L</strong> to toggle the AI sidebar from anywhere.</Li>
          <Li>In the command palette (<strong style={{ color: "rgba(255,255,255,0.65)" }}>⌘K</strong>), type your question and press <strong style={{ color: "rgba(255,255,255,0.65)" }}>⌘↵</strong> to send it to AI directly.</Li>
        </Ul>
      </Section>

      <Section title="What AI can do">
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Draft replies</strong> — Ask &quot;draft a reply declining politely&quot; and get a ready-to-send draft.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Summarize threads</strong> — Paste a long email chain and ask for a TL;DR.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Compose new emails</strong> — AI can generate a full compose with To, Subject, and Body pre-filled.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Suggest actions</strong> — AI may suggest starring, archiving, or flagging a thread as urgent.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Answer questions</strong> — Ask anything about your threads in natural language.</Li>
        </Ul>
      </Section>

      <Section title="Tone profile">
        <P>
          Dirac analyzes your last 12 sent emails to build a personal tone profile — your typical writing
          style, formality level, and common phrases. This profile is injected into every AI prompt so
          drafts sound like you, not a generic AI.
        </P>
        <P>
          Re-generate your tone profile anytime in Settings → AI.
        </P>
      </Section>

      <Section title="Context window">
        <P>
          When you open a thread in the AI sidebar, the full conversation history is sent as context.
          You can add multiple threads to the same AI session by clicking &quot;Add to context.&quot;
        </P>
        <Callout>
          Thread content is sent to your configured AI provider (OpenRouter) for inference. It is not
          stored by Dirac. See our <a href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>Privacy Policy</a> for details.
        </Callout>
      </Section>

      <Section title="Choosing a model">
        <P>
          In Settings → AI, select any model available on OpenRouter. The default is{" "}
          <strong style={{ color: "rgba(255,255,255,0.65)" }}>google/gemini-2.0-flash-001</strong> — fast and capable
          for most email tasks. For more complex reasoning, switch to a larger model like Claude or GPT-4o.
        </P>
      </Section>
    </DocLayout>
  );
}
