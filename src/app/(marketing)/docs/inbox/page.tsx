import { Metadata } from "next";
import { DocLayout, Section, P, Ul, Li, Callout } from "../_components/doc-layout";

export const metadata: Metadata = { title: "The Inbox — Dirac Docs" };

export default function InboxPage() {
  return (
    <DocLayout title="The Inbox">
      <Section title="Overview">
        <P>
          The inbox is the central view in Dirac. All threads from Gmail, Outlook, and Discord appear in a
          single list, sorted by most recent activity. Each thread shows the sender, subject, a snippet,
          and platform badge.
        </P>
      </Section>

      <Section title="Filters">
        <P>Use the filter tabs at the top of the thread list to narrow your view:</P>
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>All</strong> — Every thread across all platforms.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Unread</strong> — Threads you haven&apos;t opened yet.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Urgent</strong> — Threads marked urgent by you or flagged by AI triage.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Waiting on</strong> — Threads where you&apos;re awaiting a reply.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Starred</strong> — Threads you&apos;ve starred for follow-up.</Li>
        </Ul>
        <Callout>Press <strong>F</strong> to cycle through filters without touching the mouse.</Callout>
      </Section>

      <Section title="Thread actions">
        <P>With a thread selected, you can:</P>
        <Ul>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>E</strong> — Archive the thread (removes from inbox).</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>#</strong> — Delete / trash the thread.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>S</strong> — Star or unstar.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>U</strong> — Toggle read / unread.</Li>
          <Li><strong style={{ color: "rgba(255,255,255,0.65)" }}>X</strong> — Bulk-select the thread.</Li>
        </Ul>
      </Section>

      <Section title="Bulk actions">
        <P>
          Select multiple threads with <strong style={{ color: "rgba(255,255,255,0.65)" }}>X</strong> or the
          checkbox. A bulk action bar appears at the top when threads are selected, letting you archive,
          delete, or mark all as read at once.
        </P>
      </Section>

      <Section title="Search">
        <P>
          Press <strong style={{ color: "rgba(255,255,255,0.65)" }}>/</strong> to focus the inline search bar.
          It filters the current thread list by subject, sender name, email address, or snippet — instantly,
          with no network round-trip.
        </P>
        <P>
          For a global search across all threads, open the command palette with{" "}
          <strong style={{ color: "rgba(255,255,255,0.65)" }}>⌘K</strong> and type your query.
        </P>
      </Section>

      <Section title="Density">
        <P>
          Switch between Compact and Comfortable view density in Settings → Appearance, or via the command
          palette (search &quot;density&quot;).
        </P>
      </Section>
    </DocLayout>
  );
}
