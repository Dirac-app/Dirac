# Layout Redesign: 3-pane → Focus-mode 2-pane

## Why

The current 3-pane layout (thread list | thread content | AI sidebar) was designed for
manual triage — scan list, read content, repeat. But Dirac's value proposition is that the
AI has already done the triage before the user opens the app. The 3-pane forces a scanning
workflow that the product is designed to eliminate.

Side effects of the current layout:
- Thread cards are cramped (narrow column, clipped subject lines, tiny badges)
- Thread content is in a narrow column (reading feels claustrophobic)
- Three competing columns fight for visual attention simultaneously
- The AI sidebar feels bolted-on rather than primary

HEY's core structural insight: **one context at a time**. Inbox = inbox. Thread = thread.
Never mixed. Every element gets room to exist.

---

## New Structure

### Inbox view (no thread selected)

```
┌──────────────────────────────────┬─────────────┐
│  Thread list (full width minus   │  AI Sidebar  │
│  AI sidebar)                     │  (persistent)│
│                                  │              │
│  [Needs you]                     │              │
│  thread card ─────────────────   │              │
│  thread card ─────────────────   │              │
│                                  │              │
│  [Waiting on]                    │              │
│  thread card ─────────────────   │              │
│                                  │              │
│  [Everything else]               │              │
│  thread card ─────────────────   │              │
└──────────────────────────────────┴─────────────┘
```

Thread cards are now wide — room for:
- Larger sender name, clear subject line (not truncated)
- 2-line snippet
- Full badge row without cramping
- Triage accent left border (current system, keep it)

### Thread view (thread selected)

```
┌──────────────────────────────────┬─────────────┐
│  ← Back to inbox   [subject]     │  AI Sidebar  │
│  ─────────────────────────────   │  (same panel,│
│                                  │  now with    │
│  Full thread content             │  full thread │
│  (generous width, like Gmail     │  context)    │
│  web in full-screen)             │              │
│                                  │              │
│  Reply box at bottom             │              │
└──────────────────────────────────┴─────────────┘
```

The AI sidebar becomes more powerful here — it auto-loads the full thread as context,
shows quick actions (draft reply, summarize, mark done), without the user needing to pin.

---

## What to take from HEY

### 1. Sectioned inbox (high priority)

Instead of flat tabs, divide the visible thread list into named sections:

| Section | Condition | Equivalent |
|---|---|---|
| **Needs you** | triage = needs_reply OR isUrgent | HEY "New for you" |
| **Waiting on** | triage = waiting_on | — |
| **Everything else** | all remaining unread/read | HEY "Previously seen" |

Sections are collapsible. Each shows a count. No tab switching required — everything is
visible in one scroll, scannable at a glance.

### 2. Screener (medium priority)

A separate section (or modal/page) for first-time senders categorized as `outreach`.
The UI shows sender name, subject, snippet, and two actions: **Allow** / **Block**.

If blocked: archive + never surface again (stored in localStorage blocklist).
If allowed: moves to main inbox and gets normal categorization.

Dirac advantage over HEY: the screener is pre-populated by AI `outreach` category detection,
not manually curated. The user only sees senders the AI has flagged as cold/unsolicited.

### 3. Thread stacking (low priority / later)

Select multiple threads → view them stacked in thread view. Useful for processing a batch
of similar threads (e.g., multiple customer support emails of the same type). Defer until
core layout is solid.

### 4. Generous card design (high priority)

Current cards: forced into a narrow column, much info truncated.
New cards (full width minus sidebar): can show:
- Sender name + email domain in smaller text below
- Subject on its own line, bold if unread, no truncation
- 2-line snippet
- Badges stacked or in a row — no cramping
- Time + star in top-right corner

---

## What NOT to take from HEY

| HEY feature | Why to skip |
|---|---|
| Manual screener (no AI) | Dirac's screener is AI-powered, better |
| No-AI philosophy | Dirac is the opposite bet |
| Opinionated "imbox" as only workflow | Dirac has filters + AI triage, more flexible |
| Clip library | Out of scope, not core value prop |

---

## Implementation Plan

### Phase 1: State-driven view switching (no routing changes)

The current inbox page already has `selectedThreadId` in app state. The change is:

**Before:** Always render `<ThreadList />` + `<ThreadView />` side by side  
**After:** When `selectedThreadId` is null → full-width `<ThreadList />`; when set → full-width `<ThreadView />` with a back button

```tsx
// src/app/(app)/inbox/page.tsx
const { selectedThreadId } = useAppState();

return (
  <div className="flex flex-1 overflow-hidden">
    {selectedThreadId ? (
      <ThreadView />  {/* full width minus sidebar */}
    ) : (
      <ThreadList />  {/* full width minus sidebar */}
    )}
    <AiSidebar />
  </div>
);
```

Add a back button inside `ThreadView` that calls `setSelectedThreadId(null)`.
Add `Escape` key handler to deselect.

Animate the transition with a simple `framer-motion` slide (list slides left, thread slides in from right).

### Phase 2: Sectioned thread list

Replace the current flat list + filter tabs with inline sections:

```
─── Needs you (3) ──────────────────────────
  thread card
  thread card
  thread card

─── Waiting on (2) ─────────────────────────
  thread card
  thread card

─── Everything else ─────────────────────────
  thread card
  ...
```

Keep filter tabs as a secondary way to narrow within sections (or remove them if sections
make them redundant — to be decided).

### Phase 3: Wider thread cards

With full width available, redesign `ThreadRow` in `thread-list.tsx`:

- Remove the tight right-side column layout
- Sender name left-aligned, full width
- Subject on its own line
- Snippet below, 2 lines max
- Badges in a row below snippet
- Time + star top-right (keep current)

### Phase 4: Screener

Add a `[Screener]` section or tab that shows all `outreach`-categorized threads as
allow/block cards. No inbox placement for outreach threads until allowed.

---

## Files to change

| File | Change |
|---|---|
| `src/app/(app)/inbox/page.tsx` | View switching logic, remove side-by-side rendering |
| `src/components/inbox/thread-list.tsx` | Sectioned layout, wider cards, remove compact constraints |
| `src/components/inbox/thread-view.tsx` | Add back button, Escape handler, full-width layout |
| `src/lib/store.ts` | Possibly add `screenerDismissed: Set<string>` to localStorage |
| `src/lib/types.ts` | No changes expected |

---

## Decisions

1. **Filter tabs → removed.** Replace with inline sections (Needs you / Waiting on /
   Everything else) and a single search/filter input at the top of the thread list.
   Sections are always visible on one scroll — no tab switching needed.

2. **AI sidebar width → adaptive, simple.** Fixed width in inbox view. In thread view,
   expands slightly (e.g. from ~320px to ~380px) since the thread content is auto-loaded
   as context and the sidebar becomes the primary interaction surface.

3. **Screener → own page/route.** Located at `/inbox/screener`. Accessible via a button
   in the inbox header showing the count of pending outreach threads. Clean, no clutter
   in the main inbox.

4. **Animation → slide + fade.** Thread view slides in from the right (inbox slides out
   left) at ~220ms with a slight fade. Back navigation reverses. Uses framer-motion
   (already a dependency).
