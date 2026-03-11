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
- **Dark / light mode** — System-aware, toggleable anytime
- **Bring your own API key** — Use your own OpenRouter key and model, or use the shared default

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Auth | NextAuth.js v5 (Google + Microsoft OAuth) |
| Database | PostgreSQL via Prisma + Supabase |
| AI | OpenRouter (any model: Gemini, Claude, GPT-4o, …) |
| Styling | Tailwind CSS + shadcn/ui |
| Email APIs | Gmail REST API, Microsoft Graph API |
| Messaging | Discord REST API v10 |

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

See [`.env.example`](.env.example) for the full list of required and optional variables.

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

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss the approach.

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
