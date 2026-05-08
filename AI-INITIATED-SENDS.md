# AI-Initiated Email Sending

## Why

Dirac's value proposition is "Cursor for email" — the AI is the primary interface,
not a sidekick to the platform's native compose window. Until now, the AI could
*propose* a new email via a `compose` block in the chat, but actually sending it
required a context-switch to the floating ComposePanel: open it, hunt for the Send
button, dismiss it. That's two seconds of friction every time, and it broke the
"single conversational surface" promise the rest of the product pays for.

The morning briefing made this gap painful. A plan reads "Email Sarah confirming
Tuesday at 2 PM" — the AI drafts it perfectly, then hands you a panel.

This change makes AI-initiated sends work the way the user already thinks about
them: in the chat, in one click, with a way out for cases that genuinely need the
heavy compose surface.

## Architecture: hybrid, sidebar-first

| Path | When | UX |
|---|---|---|
| Sidebar **Send** | Recipient is valid, no attachments, no CC/BCC needed | Click Send → 5-8s undo window → ✓ Sent card |
| **Open in Compose** | Anything else (attachments, CC/BCC, large rewrites, AI-resolved address looks wrong) | Punt to floating ComposePanel as before |

Both buttons are always visible on a `compose` block. Send is the primary CTA;
Open in Compose is the escape hatch.

### What's NOT removed
- The floating ComposePanel still exists exactly as it did. We're not replacing
  it — we're stopping it from being the *only* way to send AI-drafted email.
- Replies (`draft` blocks) continue to use the existing `handleSendDraft`. This
  change only affects net-new emails (`compose` blocks).

## Safety rails

### 1. Recipient validation gate
Send button is disabled with a tooltip if `to` is empty or doesn't look like an
email address. Recipient is shown in red text on the preview when invalid.

### 2. Soft first-contact protection
"Soft" not "hard" per the product call: rather than blocking sends to new
recipients, we surface a *New recipient* badge on the compose card and extend
the undo window from 5s → 8s. This catches the "AI hallucinated an address" /
"first cold outreach" case without nagging on the common case of replying to
established contacts.

A "known contact" = anybody whose email appears as a participant on any existing
thread in the user's inbox. Computed once via `useMemo` over `threads`.

### 3. Local-delay undo (gmail-style)
Sends don't fire immediately. They get scheduled via `setTimeout` with a 5s
(8s for new contacts) delay. During that window:
- The compose card shows a yellow countdown bar with **Undo**
- A toast appears with the same affordance
- Clicking Undo cancels the timer; nothing reaches the network

This is the same model Gmail uses. It costs us nothing and removes the entire
class of "oh god I sent that to the wrong person" anxiety.

### 4. After-send card morph
Once a send completes, the heavy compose preview collapses into a single-line
green card: `✓ Sent to sarah@acme.com · Open thread →`. Click navigates to
`/inbox` and selects the resulting thread (if the platform returned a threadId).

## Recipient resolution: contact directory

The AI was previously told "`to` can be empty if unknown" — a footgun for a
system meant to actually send. We now inject a **contact directory** into every
chat request:

- Top 50 most-emailed addresses, derived from thread participants
- Excludes the user's own email and obvious noreply senders
- Format: `Name <email@domain.com> (N threads)`

The system prompt was updated to require resolving names against this directory
before producing a `compose` block, and to ask an MCQ if multiple contacts could
match. The AI is also explicitly forbidden from inventing addresses.

Implementation: `buildContactDirectory()` in `ai-sidebar.tsx`, validated through
`AiChatSchema`, rendered as a system message in `/api/ai/chat`.

## After-send awareness: `recentSends`

Every successful sidebar-send is recorded to `localStorage` under the key
`dirac_recent_sends` via `src/lib/recent-sends.ts`. The list is:
- Capped at 30 entries
- Pruned after 7 days
- Shipped with every chat request and rendered as a system message

This gives the AI persistent memory across chat turns and even across page
reloads. If the user follows up with "actually, change the meeting to
Wednesday", the AI knows to write a *follow-up* email rather than re-editing
the already-sent message.

In-flight sends (within the 5-8s undo window) are also surfaced via
`buildPendingSends()` so the AI doesn't propose a duplicate if the user
fires off "now also email Marcus" before the previous send commits.

## Morning-briefing integration

`acceptPlan` and `openWithAi` in `morning-briefing.tsx` now parse the plan
text for verbs that imply compose-vs-draft and append a hint to the prompt
sent to the AI:

- `reply`, `respond`, `follow up on`, `answer`, `acknowledge` → reply draft
- `email`, `message`, `write to`, `reach out`, `introduce`, `loop in`, `cc`,
  `forward to` → new compose

Without this hint the AI sometimes produced a `draft` block addressed to the
wrong participants when a plan called for emailing someone *outside* the
context thread.

## Files touched

| File | Change |
|---|---|
| `src/components/ai-sidebar/ai-sidebar.tsx` | New `ComposeSendState`; `composeSends` state; helpers (`isValidEmail`, `isKnownContact`, `sendNewEmail`, `handleSendCompose`, `handleCancelCompose`, `handleOpenSentThread`); `buildContactDirectory`, `buildPendingSends`; rewrite of `ComposeBlock` UI; new props through `ChatBubble` |
| `src/lib/recent-sends.ts` | **New.** `loadRecentSends`, `recordRecentSend` with TTL + cap |
| `src/lib/validation.ts` | `AiChatSchema` extended with `contactDirectory`, `recentSends` |
| `src/app/api/ai/chat/route.ts` | Accept and inject contact directory + recent sends as system messages; expanded `compose` rules in system prompt |
| `src/components/morning/morning-briefing.tsx` | `detectPlanIntent` + `intentHint` helpers feeding `acceptPlan` / `openWithAi` |

## What we explicitly didn't build

- **Real "scheduled send"** (server-side queue with cancel API). The local-delay
  undo is sufficient for the UX promise; a real scheduled send is its own feature.
- **Hard first-contact blocking.** Per the product call, we softened this to a
  warning + extended undo. A future setting could let users opt into strict mode.
- **Attachments from sidebar.** Out of scope — that's a "use the panel" path by design.
- **Auto-CC patterns** (e.g. always CC accounting on receipts). Future.
- **Send-on-behalf-of for shared accounts.** Future, post auth-rework.
