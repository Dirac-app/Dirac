# Next steps for development

Current state: functional MVP with Gmail + Outlook integration, AI sidebar with tone matching, command palette, keyboard shortcuts, and a floating compose panel. Below is a prioritized plan for what to build next.

---

## Phase 1 — Polish and reliability (next 1-2 weeks)

### Persistent thread state
Right now, starred/urgent/dismissed states are stored in `localStorage`. This means they're lost when switching browsers or devices. Move these to the database using the existing `DiracMetadata` model (which already has `urgencyScore`, `tags`, `isPinned`).

### Error handling and loading states
Several API calls fail silently or show no feedback. Add:
- Toast notifications for send success/failure, archive, trash
- Retry logic for Gmail 429 rate limits (exponential backoff)
- Skeleton loading states for thread list and message view

### Mobile responsiveness
The three-pane layout doesn't work on small screens. At minimum: collapse to single-pane on mobile, hide AI sidebar behind a toggle, make compose panel full-screen.

### Draft autosave
Save compose drafts to `localStorage` (or the database) so they survive page refreshes. Show a "Drafts" section in the Activity page that lets users resume.

---

## Phase 2 — Core features (weeks 3-5)

### Snooze
Add snooze functionality: pick a date/time, thread disappears from inbox, reappears when the snooze expires. Needs a `snoozedUntil` field (already in the schema) and a check on page load or a background job.

### Markdown compose
Support Markdown in the compose panel. Parse to clean HTML before sending. This is a strong differentiator for the developer audience.

### Contact profiles
When viewing a thread, show a panel with the sender's communication history: how many threads, last contacted, typical response time, tone you use with them. Extend the existing tone analysis per-contact.

### Thread-level AI memory
Let the AI remember decisions made on a thread ("we declined this", "follow up in 2 weeks"). Store a small key-value object per thread in `DiracMetadata.aiSummary` or a new field.

---

## Phase 3 — Scale and differentiate (weeks 6-10)

### IMAP connector
Support any email provider via IMAP/SMTP. This is the path to "universal inbox" beyond Gmail and Outlook. Significantly more complex: IMAP connection pooling, IDLE push, MIME parsing, attachment handling.

### Focus mode
A distraction-free view that only shows urgent threads and threads needing a reply. Toggle from the command palette or a keyboard shortcut. Uses the existing triage data.

### Batch AI workflows
Extend the command palette to handle multi-step requests: "Find all newsletters from the last month and archive them" should find, confirm, and execute as a single flow. Currently the AI can find or act, but not chain them.

### Email templates
Saved response templates with variable placeholders (`{{name}}`, `{{company}}`). Quick-insert from compose or AI sidebar. Useful for repetitive outreach.

### Waiting-on tracker
Surface threads where you sent the last message and are awaiting a reply. The triage system already classifies `waiting_on` — build a dedicated UI section with nudge suggestions ("It's been 5 days, want to follow up?").

---

## Technical debt to address

- **Shared parser**: `parseAiContent` is duplicated between `ai-sidebar.tsx` and previously in `spotlight-search.tsx`. Extract to `src/lib/ai-parser.ts`.
- **Thread ID resolution**: The AI sometimes hallucinates thread IDs. The current subject-matching fallback works but is fragile. Long-term fix: include thread IDs more prominently in the AI context and validate all AI-referenced IDs server-side.
- **Platform detection by ID prefix**: Code uses `threadId.startsWith("outlook-")` and `threadId.startsWith("discord-")` to determine platforms. This should use the thread's `platform` field consistently.
- **Token refresh**: Outlook and Gmail token refresh is handled inline. Extract to a shared utility with proper error handling and re-auth flow.
