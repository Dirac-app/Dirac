# Contributing to Dirac

## Development Setup

```bash
git clone https://github.com/your-username/dirac.git
cd dirac
npm install
cp .env.example .env.local   # fill in at minimum: NEXTAUTH_SECRET, NEXTAUTH_URL,
                              # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL
npx prisma migrate dev
npm run dev
```

## Branch Naming

| Prefix | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Dependencies, tooling, CI |
| `refactor/` | Code restructuring (no behaviour change) |
| `docs/` | Documentation only |

Examples: `feat/slack-integration`, `fix/gmail-429-retry`, `docs/readme-update`

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description under 72 chars>
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `perf`, `test`, `ci`

Examples:
```
feat(inbox): add snooze picker to thread view
fix(gmail): retry on 429 with exponential backoff
chore(deps): bump prisma to 7.5
```

## PR Process

1. Open a draft PR early for feedback on larger changes.
2. Fill in the PR template fully.
3. Ensure `npm run build` passes before marking ready.
4. One approval required to merge. Squash-merge preferred.
5. For large features or breaking changes, open an issue first.

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

## How to Add a New Email Provider

1. Create `src/lib/<provider>.ts` with fetch helpers (see `gmail.ts` for reference).
2. Add the `Platform` enum value in `prisma/schema.prisma` and run `prisma migrate dev`.
3. Create API routes under `src/app/api/<provider>/` (threads list, thread detail, send, status).
4. Map the new platform in `src/components/inbox/thread-list.tsx` (icon, rendering).
5. In `app-provider.tsx`, add a state slice and fetch in `fetchThreads`.
6. Document new OAuth credentials in `.env.example`.

## How to Add a New AI Route

1. Create `src/app/api/ai/<name>/route.ts` — gate it with `auth()` from `@/lib/auth`.
2. Call the OpenRouter API with the user's model preference (`UserSettings.aiModel`).
3. For streaming, use `ReadableStream` and `Content-Type: text/event-stream`.
4. Any new fenced block types the AI returns must be added to `parseAiContent` in `src/lib/ai-parser.ts` and rendered in the `ChatBubble` component.

## AI integration notes

- All AI calls go through `/api/ai/chat` which proxies to OpenRouter.
- The system prompt lives in `src/app/api/ai/chat/route.ts`. Changes here affect all AI behavior.
- AI output uses fenced blocks: `mcq`, `draft`, `compose`, `actions`, `results`. The shared parser is in `src/lib/ai-parser.ts` (`parseAiContent`).
- When adding a new AI output type, update: (1) the system prompt, (2) the parser in `ai-parser.ts`, (3) the renderer in `ChatBubble`.

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
