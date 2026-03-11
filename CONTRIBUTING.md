# Contributing to Dirac

## Development workflow

1. Create a branch off `main` for your work.
2. Run `npm run dev` and test changes locally at `http://localhost:3000`.
3. Run `npx tsc --noEmit` before committing — the codebase must type-check cleanly.
4. Keep commits focused. One feature or fix per commit.

## Code conventions

- **TypeScript** everywhere. No `any` unless absolutely unavoidable.
- **Tailwind CSS** for styling. No separate CSS files unless it's a global animation or gradient.
- **shadcn/ui** for base components. Don't reinvent buttons, dialogs, or inputs.
- Comments should explain *why*, not *what*. Don't narrate the code.
- Keep components under ~300 lines. Extract sub-components when things get long.

## Project structure

- `src/app/api/` — API routes. Each platform (Gmail, Outlook) has its own directory.
- `src/components/` — React components, grouped by feature area.
- `src/lib/` — Shared utilities, types, state management. No React here except `store.ts`.

## AI integration notes

- All AI calls go through `/api/ai/chat` which proxies to OpenRouter.
- The system prompt lives in `src/app/api/ai/chat/route.ts`. Changes here affect all AI behavior.
- AI output uses fenced blocks: `mcq`, `draft`, `compose`, `actions`, `results`. The parser is in `ai-sidebar.tsx` (`parseAiContent`).
- When adding a new AI output type, update: (1) the system prompt, (2) the parser, (3) the renderer in `ChatBubble`.

## Testing changes

- Connect a real Gmail account (Google OAuth) to test email features.
- For AI features, you need an `OPENROUTER_API_KEY` in `.env`.
- Outlook requires a Microsoft Azure app registration.

---

## Ideas for next additions

These are features that would meaningfully improve Dirac. Roughly ordered by impact.

### Snooze and reminders
Let users snooze a thread until a specific time. The thread disappears from the inbox and resurfaces when the snooze expires. Needs: a `snoozedUntil` field on threads, a periodic check (cron or polling), and UI for setting the snooze time.

### Markdown compose
Support Markdown in the compose panel — headings, bold, code blocks, links — and convert to clean HTML before sending. Developers write in Markdown. Their email client should understand that.

### Full keyboard navigation
The foundation exists (j/k, shortcuts, command palette), but full focus management is missing. Tab should move through interactive elements predictably. Screen reader and accessibility improvements fit here too.

### Focus mode
A distraction-free mode that shows only threads marked as urgent or needing reply. Hides everything else. Essentially a "deep work" inbox filter with a dedicated visual state.

### Waiting-on tracker
Threads where you sent the last message and are waiting for a reply. Surface these as a distinct group so nothing falls through the cracks. The triage system already classifies `waiting_on` — this is about making it a first-class UI feature with nudge suggestions.

### Thread-level AI memory
Let the AI remember prior decisions about a thread (e.g., "we decided to decline this") across sessions. Currently, each AI conversation starts fresh. A lightweight key-value store per thread would enable continuity.

### Contact profiles
Aggregate communication patterns per contact: how often you email them, average response time, tone you typically use. Surface this as a panel when viewing a thread. The tone analysis system already exists — this extends it per-contact.

### IMAP connector ("any email")
Support any email provider via IMAP/SMTP. This is the long-tail play — after Gmail and Outlook, every other provider matters. More complex than REST APIs (connection pooling, IDLE for push, MIME parsing) but unlocks the "universal inbox" promise.

### Email templates
Saved response templates with variable placeholders (e.g., `{{name}}`, `{{company}}`). Quick-insert from the compose panel or AI sidebar. Useful for repetitive outreach or support replies.

### Batch AI actions from search
Extend the command palette's AI to support multi-step workflows: "Find all newsletters from the last month and archive them" should work as a single query that finds, confirms, and executes.
