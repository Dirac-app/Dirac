# Testing trial, billing & reminder emails

Hands-on checklist for:

- **Upgrade wall** (`/upgrade`, expired redirects)
- **Stripe Checkout** + webhooks (`active` / `expired`)
- **14-day trial** expiry in the app
- **Usage stats** in reminder emails
- **Resend trial emails** (Edge Function, days 12 / 14 / 15)
- **Stripe customer emails** left off (no duplicate trial mail)

**Related setup (do first):**

| Doc | What |
|-----|------|
| [local-testing.md](./local-testing.md) | Localhost app + Stripe CLI + sign-up smoke test |
| [trial-reminder-emails.md](./trial-reminder-emails.md) | Deploy Edge Function, secrets, cron |
| [stripe-setup.md](./stripe-setup.md) | Products, webhooks, env vars |

---

## What runs where (read this once)

| Feature | Runs on | Vercel redeploy needed? |
|---------|---------|-------------------------|
| `/upgrade` page, expired redirect | Vercel (Next.js) | Yes, if not deployed yet |
| Usage counters (`emails_processed_count`, `ai_drafts_count`) | Vercel API routes | Yes, if not deployed yet |
| Trial reminder **emails** | **Supabase Edge Function** + Resend | **No** — deploy function + secrets only |
| Daily cron | Supabase `pg_cron` | No |

---

## Prerequisites

### Database

- [ ] `20250601000000_users_billing.sql` applied
- [ ] `20250602100000_trial_usage_reminders.sql` applied

Verify:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'trial_start_date',
    'subscription_status',
    'emails_processed_count',
    'ai_drafts_count',
    'trial_reminders_sent'
  );
```

Expect **5 rows**.

### Stripe (test mode for local)

- [ ] `STRIPE_SECRET_KEY=sk_test_...`
- [ ] `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID` (test prices)
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` (local)
- [ ] [Subscriptions and emails](https://dashboard.stripe.com/settings/billing/automatic): **all customer email toggles OFF** (especially trial reminder)

### Resend + Edge Function (for email tests)

- [ ] `dirac.app` (or your domain) **Verified** in Resend
- [ ] Edge Function `trial-reminder-emails` **deployed**
- [ ] Supabase secrets set: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, `TRIAL_REMINDER_CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Optional: send a manual test from [Resend → Emails](https://resend.com/emails) with `Dirac <billing@dirac.app>`

---

## 1. Sign-up → trialing

Follow [local-testing.md §2](./local-testing.md#2-sign-up--user-provisioning) or production sign-up.

**Pass criteria** (`public.users`):

```sql
SELECT email, subscription_status, trial_start_date, stripe_customer_id,
       emails_processed_count, ai_drafts_count, trial_reminders_sent
FROM public.users
WHERE email = 'your-test@example.com';
```

| Field | Expected |
|-------|----------|
| `subscription_status` | `trialing` |
| `trial_start_date` | ~now (set at onboarding setup, screen 3) |
| `stripe_customer_id` | `cus_...` |
| `emails_processed_count` | `0` |
| `ai_drafts_count` | `0` |
| `trial_reminders_sent` | `{}` (empty array) |

---

## 2. Active trial — no upgrade wall

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Visit `/inbox`, `/compose`, `/settings` while trialing | [ ] No redirect to `/upgrade` |
| 2 | Visit `/upgrade` while trialing | [ ] Redirect to `/inbox` |
| 3 | Sign out → visit `/inbox` | [ ] Redirect to `/signup` |

---

## 3. Usage stats (for personalized reminder emails)

Counters increment on the **deployed** app (local `npm run dev` or production).

| Action in app | Column incremented |
|---------------|-------------------|
| Send email (Gmail/Outlook) | `emails_processed_count` |
| AI chat message (sidebar) | `ai_drafts_count` (+1 per request) |
| Quick drafts | `ai_drafts_count` (+1 per option returned) |

**Test:**

1. Send one test email from Dirac (or hit `/api/gmail/send` via UI).
2. Ask AI sidebar one question.
3. Re-run:

```sql
SELECT emails_processed_count, ai_drafts_count
FROM public.users
WHERE email = 'your-test@example.com';
```

- [ ] Counts increased (may take a second; refresh query)

If counts stay `0`, confirm migration ran and you’re on code that includes `src/lib/usage-stats.ts`.

---

## 4. Upgrade wall (expired)

### 4a. Simulate expiry (fast — no 14-day wait)

```sql
UPDATE public.users
SET
  trial_start_date = NOW() - INTERVAL '15 days',
  subscription_status = 'trialing'
WHERE email = 'your-test@example.com';
```

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Run SQL above | [ ] |
| 2 | Load `/inbox` (logged in) | [ ] Redirect to `/upgrade` |
| 3 | Page shows **“Your trial has ended.”** | [ ] |
| 4 | Two buttons: **$20 / month**, **$200 / year** | [ ] |
| 5 | Supabase: `subscription_status` → `expired` (after first gated request) | [ ] |

### 4b. Expired user cannot use app

| Step | Action | Pass? |
|------|--------|-------|
| 1 | While expired, try `/inbox`, `/compose`, `/settings` | [ ] All redirect to `/upgrade` |
| 2 | `/api/stripe/checkout` still works from `/upgrade` | [ ] Redirects to Stripe Checkout |

**Reset trialing:**

```sql
UPDATE public.users
SET
  trial_start_date = NOW(),
  subscription_status = 'trialing',
  trial_reminders_sent = '{}'
WHERE email = 'your-test@example.com';
```

---

## 5. Stripe Checkout → active

**Local:** Terminal B running `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

| Step | Action | Pass? |
|------|--------|-------|
| 1 | From `/upgrade`, click **$20 / month** | [ ] `checkout.stripe.com` opens |
| 2 | Pay with `4242 4242 4242 4242`, future expiry, any CVC | [ ] |
| 3 | Return to app (`/inbox` or `?billing=success`) | [ ] |
| 4 | CLI shows `invoice.paid` (and related events) | [ ] |
| 5 | `subscription_status` = `active` | [ ] |
| 6 | `/inbox` loads; `/upgrade` redirects to `/inbox` | [ ] |

---

## 6. Stripe cancel → expired

Stripe Dashboard (**Test mode**) → Customer → Subscription → **Cancel**.

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Webhook `customer.subscription.deleted` received | [ ] |
| 2 | `subscription_status` = `expired` | [ ] |
| 3 | `/inbox` → `/upgrade` | [ ] |

---

## 7. Trial reminder emails (Resend + Edge Function)

**Does not use Vercel.** Test on Supabase + Resend only.

### 7a. Manual invoke (curl)

```bash
curl -s -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/trial-reminder-emails" \
  -H "Authorization: Bearer YOUR_TRIAL_REMINDER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

| Response | Meaning |
|----------|---------|
| `401` | Wrong/missing `TRIAL_REMINDER_CRON_SECRET` or missing `Bearer ` prefix |
| `200` + `"processed": 0` | Function OK; **no user** matches today for day 12/14/15 |
| `200` + `"processed": 1` + `"ok": true` | Email attempted for one user |
| `500` | Missing Resend/Supabase secrets — check Edge Function logs |

**Check logs:** Supabase → **Edge Functions** → `trial-reminder-emails` → **Logs**  
**Check delivery:** Resend → **Emails**

### 7b. Force a reminder for your test user

The function sends when **UTC calendar date** = `trial_start_date` + **12**, **14**, or **15** days.

**Day 12 example** (2 days before 14-day trial ends):

```sql
-- Today UTC date minus 12 days → trial_start_date
UPDATE public.users
SET
  trial_start_date = (CURRENT_DATE - INTERVAL '12 days')::timestamptz + TIME '12:00',
  subscription_status = 'trialing',
  trial_reminders_sent = '{}',
  emails_processed_count = 3,
  ai_drafts_count = 7
WHERE email = 'your-test@example.com';
```

Run **curl** again (§7a).

- [ ] Resend shows new email to `your-test@example.com`
- [ ] Subject mentions trial / Dirac
- [ ] Body includes usage stats (3 emails, 7 AI replies) if counts > 0
- [ ] Ends with **“Losing this on [date]. $20/mo to keep it.”** and upgrade link
- [ ] `trial_reminders_sent` contains `day_12`

```sql
SELECT trial_reminders_sent FROM public.users WHERE email = 'your-test@example.com';
```

**Day 14** (last trial day):

```sql
UPDATE public.users
SET
  trial_start_date = (CURRENT_DATE - INTERVAL '14 days')::timestamptz + TIME '12:00',
  trial_reminders_sent = ARRAY['day_12']  -- already got day_12
WHERE email = 'your-test@example.com';
```

Run curl → expect `day_14` appended.

**Day 15** (day after expiry):

```sql
UPDATE public.users
SET
  trial_start_date = (CURRENT_DATE - INTERVAL '15 days')::timestamptz + TIME '12:00',
  subscription_status = 'expired',
  trial_reminders_sent = ARRAY['day_12', 'day_14']
WHERE email = 'your-test@example.com';
```

Run curl → expect `day_15` appended.

### 7c. Idempotency

Run curl **twice** without changing SQL.

- [ ] Second run: `processed: 0` for that user (key already in `trial_reminders_sent`)
- [ ] No duplicate email in Resend for same reminder key

### 7d. Active subscribers skipped

```sql
UPDATE public.users
SET
  trial_start_date = (CURRENT_DATE - INTERVAL '12 days')::timestamptz,
  subscription_status = 'active',
  trial_reminders_sent = '{}'
WHERE email = 'your-test@example.com';
```

Run curl.

- [ ] No email sent to that user (`processed: 0` or user not in results)

### 7e. Cron job (production)

After creating the daily cron ([trial-reminder-emails.md Part E](./trial-reminder-emails.md#part-e--daily-cron-schedule)):

- [ ] **Integrations → Cron** shows job `trial-reminder-emails-daily`
- [ ] After scheduled time: Edge Function logs show invocation
- [ ] Or trigger **Run now** / equivalent if dashboard offers it

---

## 8. Stripe trial emails (should stay off)

- [ ] [Settings → Billing → Subscriptions and emails](https://dashboard.stripe.com/settings/billing/automatic)
- [ ] **Send a reminder email 7 days before a trial ends** = **OFF**
- [ ] Other lifecycle toggles OFF (unless you intentionally want failed-payment emails later)

Dirac trial is on `users.trial_start_date`, not Stripe `trial_period_days` — but leaving Stripe off avoids duplicates if billing changes later.

---

## 9. Production smoke test (after deploy)

| # | Check | Pass? |
|---|-------|-------|
| 1 | Vercel deployed with upgrade wall + usage stats | [ ] |
| 2 | Edge Function deployed + secrets on **production** Supabase project | [ ] |
| 3 | Cron scheduled on production project | [ ] |
| 4 | `APP_URL=https://app.dirac.app` in Edge secrets | [ ] |
| 5 | Live Stripe webhook → `https://app.dirac.app/api/stripe/webhook` | [ ] |
| 6 | Force day-12 SQL on a **test** user → curl → email arrives with `/upgrade` link | [ ] |

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `401` on curl | `TRIAL_REMINDER_CRON_SECRET` mismatch; need `Bearer ` prefix |
| `200`, `processed: 0` | No user's `trial_start_date` offset matches today (UTC) |
| Resend error in function logs | Bad `RESEND_API_KEY` or `from` not on verified domain |
| Email sent but wrong stats | Usage counters not incremented (old Vercel deploy or no user actions) |
| `/upgrade` old UI | Redeploy Vercel |
| Paid but still `expired` | Webhook not received; check `STRIPE_WEBHOOK_SECRET` and event scope |
| Duplicate trial emails | Stripe trial toggle still ON **or** cron run twice before `trial_reminders_sent` updates |

---

## Quick reset (test user)

```sql
UPDATE public.users
SET
  trial_start_date = NOW(),
  subscription_status = 'trialing',
  trial_reminders_sent = '{}',
  emails_processed_count = 0,
  ai_drafts_count = 0
WHERE email = 'your-test@example.com';
```

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [local-testing.md](./local-testing.md) | Full local dev + sign-up + Stripe CLI |
| [trial-reminder-emails.md](./trial-reminder-emails.md) | Setup: deploy, secrets, cron, Resend from-address |
| [stripe-setup.md](./stripe-setup.md) | Stripe products & webhooks |
