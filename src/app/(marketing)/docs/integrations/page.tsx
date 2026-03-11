import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "Integrations — Dirac Docs" };

export default function IntegrationsPage() {
  return (
    <DocLayout title="Integrations">
      <Section title="Gmail">
        <P>
          Gmail is connected via Google OAuth when you sign in with your Google account. Dirac requests
          the following scopes:
        </P>
        <Ul>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>gmail.readonly</code> — Read threads and messages.</Li>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>gmail.send</code> — Send and reply to emails on your behalf.</Li>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>gmail.modify</code> — Mark read/unread, archive, and trash.</Li>
        </Ul>
        <Callout>
          Dirac fetches thread metadata on load and full message content on demand. Email bodies are
          never stored on Dirac servers.
        </Callout>
      </Section>

      <Section title="Outlook">
        <P>
          Outlook is connected via Microsoft OAuth when you sign in with your Microsoft account. Dirac
          uses the Microsoft Graph API and requests:
        </P>
        <Ul>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Mail.Read</code> — Read messages and conversations.</Li>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Mail.Send</code> — Send and reply to emails.</Li>
          <Li><code style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Mail.ReadWrite</code> — Mark read/unread, archive, and trash.</Li>
        </Ul>
        <P>
          Outlook access tokens are automatically refreshed in the background — you will not be asked
          to re-authenticate unless your refresh token expires (typically after 90 days of inactivity).
        </P>
      </Section>

      <Section title="Discord">
        <P>
          Discord is connected via the onboarding screen or Settings → Integrations. Dirac uses a
          Discord bot token to read channels and send messages, and your user OAuth token only to
          identify which guilds you belong to.
        </P>
        <Ul>
          <Li>Channels are fetched from guilds where the Dirac bot is installed.</Li>
          <Li>Messages are displayed as threads in the unified inbox.</Li>
          <Li>You can send messages to any channel you have access to via compose or the AI sidebar.</Li>
        </Ul>
        <Callout>
          Discord tokens are stored in an HTTP-only cookie (30-day expiry), not in the database.
          Re-connecting resets the expiry.
        </Callout>
      </Section>

      <Section title="Coming soon">
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Slack</strong> — Workspace messages and DMs.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Telegram</strong> — Personal and group messages via bot.</Li>
        </Ul>
        <P>
          These integrations are in development.{" "}
          <a href="mailto:support@dirac.app" style={{ color: "rgba(255,255,255,0.5)", textUnderlineOffset: 3 }}>
            Contact us
          </a>{" "}
          if you want early access.
        </P>
      </Section>
    </DocLayout>
  );
}
