<div align="center">
  <h1>Dirac</h1>
  <p><strong>Cursor for email. One AI-native inbox for Gmail, Outlook, and Discord.</strong></p>
  <p>
    <a href="https://dirac.app">dirac.app</a> ·
    <a href="https://dirac.app/docs">Docs</a> ·
    <a href="#self-hosting">Self-Host</a> ·
    <a href="#contributing">Contributing</a>
  </p>
  <p>
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  </p>
</div>

---

Dirac is an open-source, keyboard-driven unified inbox that brings Gmail, Outlook, and Discord into one interface. AI is built directly into the workflow — not bolted on. Triage, understand, and respond to messages at the speed of thought.

## Features

- **Unified inbox** — Gmail, Outlook, and Discord threads in one list, sorted by most recent activity
- **AI sidebar** — Streaming AI responses powered by [OpenRouter](https://openrouter.ai). Drafts replies in your voice, summarizes threads, composes new emails, and suggests actions
- **Tone profile** — Analyzes your sent emails to match your writing style in every AI draft
- **Keyboard-first** — Full keyboard navigation (`J/K`, `E`, `S`, `U`, `#`, `R`, `C`, `/`) with a command palette (`⌘K`)
- **Inbox filters** — All · Unread · Urgent · Waiting on · Starred
- **Bulk actions** — Select multiple threads, batch archive or delete
- **Draft auto-save** — Compose drafts persist to localStorage with one-click recovery
- **Snooze** — Defer threads until later today, tomorrow morning, or next Monday
- **Commitments tracker** — AI extracts promises and deadlines from threads
- **Founder categories** — Classifies senders as investor / customer / vendor / outreach / personal
- **Topic tags** — AI-generated labels (billing, legal, hiring, etc.) on every thread
- **Sender profile** — Inline context card showing thread history and tone for each contact
- **Thread metadata persistence** — Starred and urgent state stored in PostgreSQL, merged with localStorage on load
- **Dark / light mode** — System-aware, toggleable anytime
- **Bring your own API key** — Use your own OpenRouter key and model, or use the shared default

## Architecture

```
src/
├── app/
│   ├── (app)/              # Authenticated route group (inbox, activity, settings)
│   └── api/                # Next.js API routes
│       ├── ai/             # OpenRouter-backed AI endpoints (chat, triage, urgency, …)
│       ├── gmail/          # Gmail REST proxy (threads, send, modify)
│       ├── outlook/        # Microsoft Graph proxy
│       ├── discord/        # Discord bot proxy
│       ├── auth/           # next-auth handlers
│       ├── oauth/          # Custom OAuth flows (Outlook)
│       └── threads/        # Thread metadata persistence (starred, urgent)
├── components/
│   ├── layout/             # AppShell, AppProvider (global state context), nav
│   ├── inbox/              # ThreadList, ThreadView (with snooze + sender profile)
│   ├── ai-sidebar/         # AI chat sidebar with session history
│   ├── compose/            # ComposePanel (floating, minimisable)
│   └── command-palette/    # SpotlightSearch (⌘K)
└── lib/
    ├── auth.ts             # next-auth config + Google token refresh
    ├── gmail.ts            # Gmail REST helpers (429 retry + exponential backoff)
    ├── outlook.ts          # Microsoft Graph helpers
    ├── token-refresh.ts    # Shared OAuth token refresh (Google + Microsoft)
    ├── ai-parser.ts        # Shared AI response parser (fenced blocks)
    ├── store.ts            # Global AppState React context + types
    ├── types.ts            # Shared TypeScript types (DiracThread, SnoozeState, …)
    └── db.ts               # Prisma client singleton
```

**Data flow:** The browser fetches threads from `/api/gmail/threads` (etc.) on load. All UI state lives in `AppProvider` (React context). Starred/urgent metadata is written to PostgreSQL via `/api/threads/metadata` on every toggle; on fresh load the DB state is merged with localStorage so the UI is always fast.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Auth | NextAuth.js v5 (Google + Microsoft OAuth) |
| Database | PostgreSQL via Prisma 7 |
| AI | OpenRouter (any model: Gemini, Claude, GPT-4o, …) |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Email APIs | Gmail REST API, Microsoft Graph API |
| Messaging | Discord REST API v10 |
| Icons | Lucide React |
| Animations | Framer Motion |

## Self-Hosting

### Prerequisites

- Node.js 20+
- PostgreSQL (Supabase, Neon, Railway, or self-hosted)
- Google OAuth app (for Gmail)
- Microsoft Azure app registration (for Outlook)
- OpenRouter API key (optional — users can bring their own)

### Setup

```bash
git clone https://github.com/Dirac-app/Dirac.git
cd Dirac
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your credentials (see `.env.example` for all variables), then:

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev
```

For production:

```bash
npm run build
npm run start
```

### OAuth setup

**Google (Gmail)**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Enable the Gmail API

**Microsoft (Outlook)**
1. Go to [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Add redirect URI: `https://your-domain.com/api/oauth/outlook/callback`
3. Add permissions: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `offline_access`

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Session signing key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Deployment URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Gmail | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Gmail | Google OAuth client secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AZURE_CLIENT_ID` | Outlook | Azure App Registration ID |
| `AZURE_CLIENT_SECRET` | Outlook | Azure client secret |
| `AZURE_TENANT_ID` | Outlook | Tenant (`common` for multi-tenant) |
| `OPENROUTER_API_KEY` | No | Server-side AI key (users can supply their own) |
| `OPENROUTER_MODEL` | No | Default model slug |
| `DISCORD_BOT_TOKEN` | Discord | Discord bot token |

See [`.env.example`](.env.example) for the full documented list with setup instructions.

## Project structure

```
src/
├── app/
│   ├── (app)/           # Authenticated app routes (inbox, activity, settings)
│   ├── (marketing)/     # Public pages (home, docs, privacy, terms)
│   └── api/             # API routes (gmail, outlook, discord, ai, oauth)
├── components/
│   ├── inbox/           # Thread list, thread view
│   ├── ai-sidebar/      # AI chat sidebar
│   ├── compose/         # Compose panel with draft recovery
│   ├── command-palette/ # ⌘K spotlight search
│   └── keyboard-shortcuts/
├── lib/
│   ├── gmail.ts         # Gmail REST API wrapper
│   ├── outlook.ts       # Microsoft Graph API wrapper
│   ├── discord.ts       # Discord REST API wrapper
│   ├── auth-guard.ts    # Per-route auth middleware
│   ├── validation.ts    # Zod schemas for all API routes
│   └── store.ts         # Global app state (React context)
└── prisma/
    └── schema.prisma    # Database schema
```

## Deployment (Vercel)

1. Push your fork to GitHub.
2. Import at [vercel.com/new](https://vercel.com/new) and select your repository.
3. Add all environment variables from `.env.example` under **Settings → Environment Variables**.
4. Set `NEXTAUTH_URL` to your Vercel domain.
5. Update Google / Azure OAuth redirect URIs to match your Vercel domain.
6. Add a custom build command in `vercel.json` to run migrations before building:
   ```json
   { "buildCommand": "prisma migrate deploy && next build" }
   ```
7. Deploy.

Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) for a serverless-compatible PostgreSQL database.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide, including branch naming, commit format, and how to add a new email provider.

Quick version — pull requests are welcome. For larger changes, open an issue first to discuss the approach.

```bash
# Fork the repo, then:
git clone https://github.com/your-username/Dirac.git
cd Dirac
npm install
cp .env.example .env.local  # fill in your dev credentials
npm run dev
```

- Bug fixes and small improvements — open a PR directly
- New integrations or features — open an issue first
- Typos and docs — always welcome

Please keep PRs focused. One feature or fix per PR makes review much faster.

## Roadmap

- [ ] Slack integration
- [ ] Telegram integration
- [ ] Advanced search with saved filters
- [ ] Export threads as PDF / JSON / MBOX
- [ ] Scheduled send
- [ ] Mobile-responsive layout

## License

[MIT](LICENSE) — free to use, modify, and distribute, including for commercial purposes.

---

<div align="center">
  <sub>Built with ♥ · <a href="https://dirac.app">dirac.app</a></sub>
</div>
