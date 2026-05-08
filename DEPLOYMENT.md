# Deployment guide

This guide covers deploying Dirac on a new machine after cloning the repo. It assumes your `.env` values are largely the same (same OAuth apps, same API keys) and you just need to get the app running.

---

## Option A: Local development (new machine)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd dirac-web
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your existing credentials. The values that stay the same across machines:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `TOKEN_ENCRYPTION_KEY`

Values you may need to change:
- `DATABASE_URL` — point to your PostgreSQL instance (local or remote)
- `AUTH_SECRET` — can reuse the same one, or generate a new one with `openssl rand -base64 32`
- `AUTH_URL` — `http://localhost:3000` for local dev
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev

### 3. Set up the database

If using a fresh PostgreSQL database:

```bash
npx prisma db push
```

This creates all tables from the schema. If your database already has the tables (e.g., you're connecting to an existing remote database), skip this step.

### 4. Generate the Prisma client

```bash
npx prisma generate
```

### 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Option B: Railway deployment (production)

Railway is the recommended deployment platform. It handles Docker builds, PostgreSQL provisioning, and environment variables through a dashboard.

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and create a new project.
2. Choose "Deploy from GitHub repo" and connect your repository.

### 2. Add a PostgreSQL database

1. In your Railway project, click "New" → "Database" → "PostgreSQL".
2. Railway auto-provisions the database and exposes a `DATABASE_URL`.
3. Copy the `DATABASE_URL` from the database service's variables.

### 3. Set environment variables

In the Railway service settings, add all variables from `.env.example`. Key differences for production:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | The Railway-provided PostgreSQL URL |
| `AUTH_URL` | `https://dirac.app` (or your domain) |
| `NEXT_PUBLIC_APP_URL` | `https://dirac.app` |
| `NODE_ENV` | `production` |

Everything else (OAuth credentials, API keys, encryption keys) stays the same as your dev environment.

### 4. OAuth redirect URIs

Make sure your OAuth apps allow the production redirect URIs. You should have added these when you first created the OAuth credentials, but double-check:

**Google (Gmail):**
- Authorized redirect URI: `https://dirac.app/api/auth/callback/google`
- Authorized JavaScript origin: `https://dirac.app`

**Microsoft (Outlook):**
- Redirect URI: `https://dirac.app/api/oauth/outlook/callback`

**Discord:**
- OAuth2 redirect: `https://dirac.app/api/oauth/discord/callback`

### 5. Deploy

Railway auto-deploys on git push. It will:
1. Detect the `Dockerfile`
2. Build the Next.js standalone output
3. Run `node server.js` on port 3000

### 6. Custom domain

In Railway service settings → "Settings" → "Networking" → "Custom Domain", add `dirac.app` (or your domain). Railway provides the DNS records to configure.

---

## Option C: Docker (any server)

### 1. Build the image

```bash
docker build -t dirac-web .
```

### 2. Run with environment variables

```bash
docker run -p 3000:3000 \
  --env-file .env \
  dirac-web
```

Or pass variables individually:

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e OPENROUTER_API_KEY="..." \
  -e NEXT_PUBLIC_APP_URL="https://dirac.app" \
  -e NODE_ENV="production" \
  dirac-web
```

### 3. Database migration

Before the first run, push the schema to your database:

```bash
npx prisma db push
```

Or if running from Docker, exec into the container or run it as a build step.

---

## Post-deployment checklist

- [ ] App loads at the production URL
- [ ] "Sign in with Google" works (OAuth redirect succeeds)
- [ ] Gmail threads sync and display in the inbox
- [ ] AI sidebar responds to prompts (OpenRouter key works)
- [ ] Compose and send an email (Gmail send works)
- [ ] Outlook connection works (if using)
- [ ] `Cmd+/` command palette opens and search works
- [ ] Dark mode toggle works
- [ ] Check the browser console for errors

## Troubleshooting

**"This app isn't verified" on Google sign-in**
This is normal for development. Click "Advanced" → "Go to Dirac (unsafe)" to continue. For production, submit your OAuth app for Google verification.

**Gmail API 429 rate limit**
You're making too many API calls. The app has built-in concurrency limiting, but if you have many threads, you may hit this on first sync. Wait a minute and refresh.

**Outlook 403 errors**
Make sure `User.Read`, `Mail.Read`, `Mail.ReadWrite`, and `Mail.Send` API permissions are granted in the Azure app registration, and admin consent is given if required.

**Database connection refused**
Check that `DATABASE_URL` points to a running PostgreSQL instance and the credentials are correct. For Railway, use the internal URL (not the public one) if the app and database are in the same project.

**AUTH_SECRET mismatch**
If you change `AUTH_SECRET` between deployments, all existing sessions are invalidated. Users will need to sign in again. This is fine — just be aware of it.
