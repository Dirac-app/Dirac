import { Metadata } from "next";
import { DocLayout, Section, P, Callout, ShortcutRow } from "../_components/doc-layout";

export const metadata: Metadata = { title: "Keyboard Shortcuts — Dirac Docs" };

export default function ShortcutsPage() {
  return (
    <DocLayout title="Keyboard Shortcuts">
      <Section title="Overview">
        <P>
          Dirac is designed to be fully keyboard-driven. Every common action has a shortcut.
          Shortcuts are disabled when a text input is focused.
        </P>
        <Callout>Press <strong>?</strong> anywhere in the app to open the shortcuts overlay.</Callout>
      </Section>

      <Section title="Navigation">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ShortcutRow keys={["J"]} desc="Next thread" />
          <ShortcutRow keys={["K"]} desc="Previous thread" />
          <ShortcutRow keys={["G", "I"]} desc="Go to Inbox" />
          <ShortcutRow keys={["G", "A"]} desc="Go to Activity" />
          <ShortcutRow keys={["G", "S"]} desc="Go to Settings" />
          <ShortcutRow keys={["Esc"]} desc="Deselect thread" />
        </div>
      </Section>

      <Section title="Thread actions">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ShortcutRow keys={["E"]} desc="Archive thread" />
          <ShortcutRow keys={["#"]} desc="Delete (trash) thread" />
          <ShortcutRow keys={["S"]} desc="Star / unstar" />
          <ShortcutRow keys={["U"]} desc="Toggle read / unread" />
          <ShortcutRow keys={["X"]} desc="Bulk-select thread" />
        </div>
      </Section>

      <Section title="Compose & search">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ShortcutRow keys={["C"]} desc="Compose new email" />
          <ShortcutRow keys={["/"]} desc="Focus inline search" />
          <ShortcutRow keys={["F"]} desc="Cycle inbox filter" />
          <ShortcutRow keys={["⌘K"]} desc="Open command palette" />
        </div>
      </Section>

      <Section title="AI">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ShortcutRow keys={["R"]} desc="Open AI sidebar for selected thread" />
          <ShortcutRow keys={["⌘L"]} desc="Toggle AI sidebar" />
          <ShortcutRow keys={["⌘↵"]} desc="Send query to AI (in command palette)" />
        </div>
      </Section>

      <Section title="Tips">
        <P>
          The <strong style={{ color: "rgba(255,255,255,0.65)" }}>G</strong> prefix shortcuts (G then I, A, S)
          use a 500ms window — press G, then the second key within half a second.
        </P>
        <P>
          The command palette (<strong style={{ color: "rgba(255,255,255,0.65)" }}>⌘K</strong>) supports all
          the same actions and more, discoverable by typing.
        </P>
      </Section>
    </DocLayout>
  );
}
