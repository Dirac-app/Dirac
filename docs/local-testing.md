# Local testing (Dirac Web)

Assumes you already completed [supabase-setup.md](./supabase-setup.md) and [stripe-setup.md](./stripe-setup.md). This is a hands-on pass on **localhost** before shipping to Vercel.

---

## Prerequisites checklist

Tick these before you start testing.

### Environment

- [ ] `.env.local` exists (copied from `.env.local.example`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SECRET_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`, Google OAuth vars set (for Gmail)
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000` (Checkout redirect URLs)
- [ ] Stripe **test mode**: `STRIPE_SECRET_KEY=sk_test_...`
- [ ] `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_ANNUAL_PRICE_ID` are **test** price IDs
- [ ] `STRIPE_WEBHOOK_SECRET` will come from `stripe listen` (see below)

### Supabase

- [ ] `public.users` migration ran (SQL as **postgres**)
- [ ] Google provider enabled in **Authentication → Providers**
- [ ] **URL configuration** includes:
  - Site URL: `http://localhost:3000`
  - Redirect URL: `http://localhost:3000/auth/callback`
- [ ] Google Cloud OAuth client has redirect: `https://<project-ref>.supabase.co/auth/v1/callback`

### Stripe

- [ ] Test products/prices created ($20/mo, $200/yr)
- [ ] Stripe CLI installed: `stripe --version`

### Optional (not required for auth/billing smoke test)

- [ ] `invite_codes` table (legacy beta `/` flow)
- [ ] `OPENROUTER_API_KEY` (AI features)
- [ ] Outlook / Discord vars

---

## 1. Start the app

**Terminal A** — Next.js:

```bash
cd /path/to/Dirac-Web
npm install
npm run dev
```

- [ ] App loads at [http://localhost:3000](http://localhost:3000)

**Terminal B** — Stripe webhooks (keep running):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

- [ ] CLI prints `Ready!` and a webhook signing secret `whsec_...`
- [ ] Paste that into `.env.local` as `STRIPE_WEBHOOK_SECRET`
- [ ] Restart **Terminal A** (`Ctrl+C`, then `npm run dev` again) so the new secret loads

---

## 2. Sign-up & user provisioning

One Google sign-in grants Gmail + Supabase billing (via `/auth/complete`).

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Open [http://localhost:3000/signup](http://localhost:3000/signup) | [ ] |
| 2 | Click **Continue with Google** → consent (Gmail + profile) | [ ] |
| 3 | Brief stop at `/auth/complete`, then `/inbox` (not `/signup?error=...`) | [ ] |
| 4 | Inbox loads threads — **not** “No accounts connected” | [ ] |

**Supabase checks** (Table Editor → `users`):

- [ ] One new row with your Google **email**
- [ ] `name` filled from Google profile
- [ ] `subscription_status` = `trialing`
- [ ] `trial_start_date` is today (approx.)
- [ ] `stripe_customer_id` starts with `cus_` (requires `STRIPE_SECRET_KEY`)

**Stripe checks** (Dashboard → **Test mode** → Customers):

- [ ] Customer exists with same email
- [ ] Metadata includes `supabase_user_id`

**If sign-up fails**

| URL / symptom | Likely fix |
|---------------|------------|
| `/signup?error=auth` | Supabase redirect URL or Google OAuth redirect mismatch |
| `/signup?error=provision` | Missing `users` table, bad secret key, or Stripe API error (check Terminal A logs) |

---

## 3. Trial gating (active trial)

| Step | Action | Pass? |
|------|--------|-------|
| 1 | While signed in, visit `/inbox`, `/compose`, `/settings` | [ ] All load (no redirect to `/upgrade`) |
| 2 | Visit `/upgrade` while trialing | [ ] Redirected to `/inbox` |
| 3 | Sign out (or use incognito) → visit `/inbox` | [ ] Redirected to `/signup` |

---

## 4. Upgrade & Checkout (Stripe test mode)

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Open [http://localhost:3000/upgrade](http://localhost:3000/upgrade) | [ ] |
| 2 | Click **Monthly — $20/mo** | [ ] Redirects to `checkout.stripe.com` |
| 3 | Pay with test card `4242 4242 4242 4242`, any future date, any CVC | [ ] |
| 4 | After success, return to `/inbox?billing=success` (or `/inbox`) | [ ] |

**Terminal B** should show webhook events, e.g. `checkout.session.completed`, `invoice.paid`.

**Supabase** → `users`:

- [ ] `subscription_status` = `active`

| Step | Action | Pass? |
|------|--------|-------|
| 5 | Visit `/upgrade` while **active** | [ ] Redirected to `/inbox` |
| 6 | Use app normally (`/inbox`, etc.) | [ ] |

---

## 5. Subscription cancelled → expired

In Stripe Dashboard (**Test mode**) → **Customers** → your customer → **Subscriptions** → **Cancel subscription**.

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Terminal B shows `customer.subscription.deleted` | [ ] |
| 2 | Supabase `users.subscription_status` = `expired` | [ ] |
| 3 | Refresh `/inbox` | [ ] Redirected to `/upgrade` |
| 4 | `/upgrade` shows Monthly / Annual buttons | [ ] |

---

## 6. Simulate trial expiry (optional)

Stripe trial is **not** used; the app expires after **14 days** from `trial_start_date`. To test without waiting:

**Supabase SQL Editor** (as **postgres**):

```sql
UPDATE public.users
SET
  trial_start_date = NOW() - INTERVAL '15 days',
  subscription_status = 'trialing'
WHERE email = 'your-email@example.com';
```

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Run SQL above | [ ] |
| 2 | Load `/inbox` | [ ] Redirect to `/upgrade` |
| 3 | `users.subscription_status` flipped to `expired` | [ ] |

Reset for more tests:

```sql
UPDATE public.users
SET
  trial_start_date = NOW(),
  subscription_status = 'trialing'
WHERE email = 'your-email@example.com';
```

---

## 7. Gmail OAuth redirect (same sign-up)

Google Cloud **Authorized redirect URIs** on your Web client must include:

```text
http://localhost:3000/api/auth/callback/google
```

Supabase **Google provider Client IDs** must match `GOOGLE_CLIENT_ID` in `.env.local` (for `/auth/complete` ID-token link).

---

## 8. Quick API sanity checks (optional)

With dev server running and logged in (browser session cookie):

```bash
# Checkout session (should return JSON with "url")
curl -s -X POST "http://localhost:3000/api/stripe/checkout?plan=monthly" \
  -H "Cookie: $(node -e "console.log(require('fs').readFileSync('/dev/stdin','utf8'))" <<< '')" 
```

Easier: use **Upgrade** in the UI; use curl only if debugging.

Webhook health (Stripe CLI):

```bash
stripe trigger invoice.paid
```

- [ ] Terminal B receives event (may not match a real customer unless you use test helpers; UI checkout is the reliable path)

---

## 9. Clean re-test (optional)

To sign up again as a fresh user:

1. Supabase **Authentication** → **Users** → delete test user  
2. Supabase **Table Editor** → `users` → delete row  
3. Stripe **Customers** → delete test customer (test mode)  
4. Clear site cookies for `localhost` or use incognito  

- [ ] Full sign-up flow works again

---

## 10. Before production

- [ ] Replace test Stripe keys with **live** keys on Vercel only  
- [ ] Create **live** webhook endpoint → `https://app.dirac.app/api/stripe/webhook`  
- [ ] Supabase production URLs: `https://app.dirac.app/auth/callback`  
- [ ] `NEXT_PUBLIC_APP_URL=https://app.dirac.app` on Vercel  
- [ ] Never commit `.env.local` or paste secret keys in chat  

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [testing-trial-billing.md](./testing-trial-billing.md) | **Trial emails (Resend), upgrade wall, usage stats, day 12/14/15 tests** |
| [trial-reminder-emails.md](./trial-reminder-emails.md) | Deploy Edge Function, secrets, cron setup |
| [supabase-setup.md](./supabase-setup.md) | Project, SQL, Google Auth |
| [stripe-setup.md](./stripe-setup.md) | Products, webhooks, env vars |
| `.env.local.example` | Full env template |
