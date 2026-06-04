# Supabase setup for Dirac (from scratch)

This guide walks through creating a new Supabase project for **Dirac Web** (`app.dirac.app`): database tables, Google sign-in, environment variables, and a quick verification pass.

Dirac uses Supabase for:

| Use | How |
|-----|-----|
| **Product sign-up / billing** | Supabase Auth (Google) + `public.users` |
| **Beta invite codes** (optional) | `invite_codes` + service role |
| **Scheduled send queue** | `scheduled_emails` + service role |

Sign-up uses **one Google sign-in** (NextAuth with Gmail scopes), then `/auth/complete` links your Supabase session for billing. Use the **same** Google OAuth client ID in Supabase → Google provider and in `.env.local` (`GOOGLE_CLIENT_ID`).

---

## 1. Create the Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project**
   - **Name**: `dirac` (or your preference)
   - **Database password**: generate and store in a password manager
   - **Region**: closest to your users (e.g. `us-east-1` if most users are US)
3. Wait until the project status is **Active** (~2 minutes).

---

## 2. Copy API keys into the app

1. In the dashboard: **Project Settings** → **API Keys** (or **Connect** → copy keys).
2. You will see **two generations** of keys. They are **not interchangeable strings**—pick one pair from the same generation:

| Generation | Client (low privilege) | Server (elevated) |
|------------|------------------------|-------------------|
| **New (preferred)** | `sb_publishable_...` | `sb_secret_...` |
| **Legacy** | `anon` JWT (`eyJ...`, payload has `"role":"anon"`) | `service_role` JWT (`eyJ...`, `"role":"service_role"`) |

The new publishable key and legacy anon key do the **same job** (identify your app to Supabase + RLS as `anon` / `authenticated`). The new secret key and legacy `service_role` do the **same job** (bypass RLS on the server). [Supabase docs](https://supabase.com/docs/guides/api/api-keys).

### Recommended `.env.local` (new keys)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co

# Browser + auth session (from API Keys → Publishable)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Server only (from API Keys → Secret) — never NEXT_PUBLIC_
SUPABASE_SECRET_KEY=sb_secret_...
```

### Legacy `.env.local` (still supported)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Dirac checks **publishable first**, then falls back to anon; **secret first**, then service_role (`src/lib/supabase/keys.ts`).

| Variable | Safe in browser? | Purpose |
|----------|------------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | New client key (`sb_publishable_...`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Legacy client key (JWT) |
| `SUPABASE_SECRET_KEY` | **Never** | New server key (`sb_secret_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | Legacy server key (JWT) |

**Do not** put the publishable/anon key in the secret slot, or vice versa. Secret keys **bypass RLS**—only use in API routes, callbacks, and webhooks.

---

## 3. Run database migrations (SQL)

Open **SQL Editor** → **New query**, then run the scripts below **in order**.

Alternatively, if you use the [Supabase CLI](#optional-supabase-cli), apply files under `supabase/migrations/`.

### 3.1 Users & billing (required)

Creates `subscription_status` enum and `public.users` (linked to `auth.users`).

```sql
-- From: supabase/migrations/20250601000000_users_billing.sql

CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'expired');

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_start_date TIMESTAMPTZ,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_subscription_status_idx ON public.users (subscription_status);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid () = id);

-- Inserts/updates use SUPABASE_SERVICE_ROLE_KEY on the server.
```

**Row lifecycle**

- On first Google sign-in, the app inserts a row with `subscription_status = 'trialing'` and `trial_start_date = now()`.
- Stripe webhooks set `active` or `expired`.
- After 14 days on trial, the app sets `expired` and redirects to `/upgrade`.

### 3.2 Beta invite codes (optional)

Only needed if you use `/` access codes or `/backstage` admin.

```sql
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id SERIAL PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  tester_name TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  github_username TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (server) accesses this table.
```

### 3.3 Scheduled emails (optional)

Used by **Schedule send** (`/api/emails/schedule`). `user_id` stores the NextAuth user id (email string), not the Supabase UUID.

```sql
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  to_address TEXT NOT NULL,
  cc_address TEXT,
  bcc_address TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_emails_user_status_idx
  ON public.scheduled_emails (user_id, status);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Server uses service role; no client policies required today.
```

Allowed `status` values in app code: `PENDING`, `CANCELLED` (and `SENT` when you add a worker).

### 3.4 Verify tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'invite_codes', 'scheduled_emails');
```

You should see at least `users`. Add the others if you enabled those features.

---

## 4. Configure Supabase Auth (Google)

### 4.1 Google Cloud OAuth client (for Supabase)

1. [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Services** → **Credentials**.
2. **Create credentials** → **OAuth client ID** → **Web application**.
3. **Authorized redirect URIs** — add Supabase’s callback (from Supabase dashboard **Authentication** → **Providers** → **Google**):

   ```
   https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
   ```

   Find `<YOUR-PROJECT-REF>` in `NEXT_PUBLIC_SUPABASE_URL` (subdomain before `.supabase.co`).

4. Copy **Client ID** and **Client secret**.

### 4.2 Enable Google in Supabase

1. **Authentication** → **Providers** → **Google** → Enable.
2. Paste Client ID and Client secret → **Save**.

### 4.3 URL configuration

**Authentication** → **URL configuration**:

| Field | Local | Production |
|-------|-------|------------|
| **Site URL** | `http://localhost:3000` | `https://app.dirac.app` |
| **Redirect URLs** | `http://localhost:3000/auth/callback` | `https://app.dirac.app/auth/callback` |

Add **both** local and production URLs if you develop locally and deploy to Vercel.

The app exchanges the OAuth code at `/auth/callback`, provisions `public.users`, and redirects to `/inbox`.

### 4.4 Auth settings (recommended)

**Authentication** → **Providers** → **Email**:

- Disable email/password sign-up if you only want Google (optional).

**Authentication** → **Settings**:

- Confirm **JWT expiry** meets your needs (default is fine for MVP).

---

## 5. Google OAuth (two clients)

Dirac uses **two** Google OAuth flows:

| Flow | Redirect URI | Env vars |
|------|----------------|----------|
| **Supabase** (sign-up / billing) | `https://<ref>.supabase.co/auth/v1/callback` | Configured in Supabase dashboard only |
| **NextAuth** (Gmail read/send) | `https://app.dirac.app/api/auth/callback/google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL` |

You can use one Google Cloud project with **two OAuth clients**, or two projects. Do not mix redirect URIs on a single client.

For NextAuth, enable the **Gmail API** and add scopes documented in `.env.example`.

---

## 6. Wire environment variables

Copy `.env.local.example` → `.env.local` and fill in at minimum:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App URL (Checkout + OAuth)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Stripe (required for billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONTHLY_PRICE_ID=
STRIPE_ANNUAL_PRICE_ID=

# NextAuth + Gmail (required for inbox features)
NEXTAUTH_SECRET=          # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

On **Vercel**: Project → **Settings** → **Environment Variables** — same keys for Production (and Preview if needed).

---

## 7. Stripe + Supabase together

After Supabase Auth works:

1. Create Stripe products/prices ($20/mo, $200/yr).
2. Webhook: `https://app.dirac.app/api/stripe/webhook`  
   Events: `invoice.paid`, `customer.subscription.deleted`.
3. First sign-up creates `stripe_customer_id` on `public.users` automatically.

See `.env.example` Stripe section for details.

---

## 8. Local development

```bash
npm install
npm run dev
```

1. Open [http://localhost:3000/signup](http://localhost:3000/signup).
2. **Continue with Google** → should land on `/inbox`.
3. In Supabase **Table Editor** → `users`: one row, `trialing`, `trial_start_date` set, `stripe_customer_id` present (if `STRIPE_SECRET_KEY` is set).

**Stripe webhooks locally**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the CLI `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## 9. Production (Vercel)

1. Deploy with all env vars from §6.
2. Update Supabase **URL configuration** with production Site URL and redirect URL.
3. Register production Stripe webhook URL.
4. Point marketing site CTA to `https://app.dirac.app/signup`.

---

## 10. Verification checklist

- [ ] `public.users` exists with RLS enabled
- [ ] Google provider enabled; redirect URLs include `/auth/callback`
- [ ] Sign-up creates row in `users` with `trialing`
- [ ] `stripe_customer_id` populated when `STRIPE_SECRET_KEY` is set
- [ ] Expired trial redirects to `/upgrade`
- [ ] Checkout + webhook sets `subscription_status` to `active`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** exposed to the browser
- [ ] (Optional) `invite_codes` works for beta `/` flow
- [ ] (Optional) `scheduled_emails` accepts POST from `/api/emails/schedule`

**Quick SQL checks**

```sql
-- Recent sign-ups
SELECT id, email, name, subscription_status, trial_start_date, stripe_customer_id, created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- Auth users without app profile (should be empty after successful signup)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.users p ON p.id = u.id
WHERE p.id IS NULL;
```

---

## Optional: Supabase CLI

For migration files in-repo (`supabase/migrations/`):

```bash
# Install CLI: https://supabase.com/docs/guides/cli
brew install supabase/tap/supabase

cd /path/to/Dirac-Web
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>

# Push migrations to remote
supabase db push
```

`project-ref` is the subdomain in your Supabase URL.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Redirect to `/signup?error=auth` | Redirect URL mismatch; check §4.3 and Google redirect URI |
| Redirect to `/signup?error=provision` | Missing `users` table, Stripe error, or invalid `SUPABASE_SERVICE_ROLE_KEY` |
| `invite_codes table does not exist` | Run §3.2 SQL |
| Sign-in works but Gmail 401 | Connect Gmail via NextAuth (onboarding/settings), not Supabase alone |
| RLS blocks server writes | Server must use **service role** key, not anon key |
| Session not persisting locally | Same-site cookies: use `http://localhost:3000` consistently in Site URL and `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` |

---

## Related files in this repo

| Path | Purpose |
|------|---------|
| `supabase/migrations/20250601000000_users_billing.sql` | Users & billing schema |
| `src/app/signup/page.tsx` | Google sign-up UI |
| `src/app/auth/callback/route.ts` | OAuth callback + user provisioning |
| `src/lib/provision-user.ts` | Creates `users` row + Stripe customer |
| `src/proxy.ts` | Session refresh + trial gating |
| `src/lib/users-db.ts` | User DB helpers (service role) |
| `.env.local.example` | Env template |

---

## Security notes

- Enable RLS on every `public` table (done in scripts above).
- Do not add `INSERT`/`UPDATE` policies on `users` for `authenticated` unless you implement them carefully; billing updates go through the service role and Stripe webhooks.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` if it is ever leaked; update Vercel env immediately.
- Review [Supabase security advisors](https://supabase.com/docs/guides/database/database-linter) in the dashboard after go-live.
