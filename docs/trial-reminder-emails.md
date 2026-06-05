# Trial reminder emails — step-by-step setup

This guide assumes production at **https://app.dirac.app** and Supabase project **Dirac**. Adjust names/URLs if yours differ.

---

## What you are building (one sentence)

A small program that lives **on Supabase’s servers** (not Vercel), runs **once per day**, finds users on day 12 / 14 / 15 of their trial, and sends them email through **Resend**.

That program is called an **Edge Function**. The file is in your repo:

`supabase/functions/trial-reminder-emails/index.ts`

Until you **deploy** it, that code only exists on your laptop — Supabase cannot run it.

---

## Part A — Resend (email provider)

### A1. Create account

1. Go to [https://resend.com](https://resend.com) and sign up.
2. You get a **sandbox** first: you can only send to **your own** verified email until a domain is verified.

### A2. Verify a sending domain (required for real users)

You must send from an address on a domain you control (e.g. `dirac.app`).

1. Resend dashboard → **Domains** → **Add Domain**.
2. Enter something like `notifications.dirac.app` (subdomain is fine) or `dirac.app`.
3. Resend shows **DNS records** (TXT, MX, etc.). Add them in your DNS provider (Cloudflare, Vercel DNS, etc.).
4. Wait until Resend shows **Verified** (often 5–30 minutes, sometimes longer).

### A3. Choose your “from” address (`RESEND_FROM_EMAIL`)

**There is no screen in Resend to “pick” or “register” a from address.**

Resend’s docs are explicit: once `dirac.app` is **Verified** (which yours is), you can send from **any** `something@dirac.app` — you only declare the address when you **send** an email (API, test send, or our Edge Function secret).

Official explanation:  
[How do I create an email address or sender in Resend?](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)

**You choose the from line yourself** in this format:

```text
Display Name <local-part@your-verified-domain>
```

For your setup (`dirac.app` verified), good options:

| What users see | `RESEND_FROM_EMAIL` value to paste in Supabase |
|----------------|------------------------------------------------|
| **Dirac** from billing@dirac.app | `Dirac <billing@dirac.app>` |
| **Dirac** from hello@dirac.app | `Dirac <hello@dirac.app>` |
| **Peter from Dirac** | `Peter from Dirac <peter@dirac.app>` |

- **Display name** (before `<`) = inbox “From” label — change anytime by editing the secret; no Resend UI step.
- **Email** (inside `<>`) must end with `@dirac.app` — the mailbox does **not** need to exist in Google Workspace unless you want replies.

**Where Dirac uses it:** Supabase secret `RESEND_FROM_EMAIL` → read by `supabase/functions/trial-reminder-emails/index.ts` when calling Resend.

**Bad (will fail):** `billing@gmail.com` or `hello@notifications.dirac.app` if only `dirac.app` is verified (not a subdomain).

### A3b. Try it in Resend UI (optional sanity check)

Resend does not have a “from address settings” page. To **test** a from line:

1. [Resend → Emails](https://resend.com/emails) (sidebar)
2. **Send email** / compose (wording may vary)
3. In the **From** field, type e.g. `Dirac <billing@dirac.app>`
4. Send to yourself (`peter@dirac.app`)

If that delivers, use the **same exact From string** as `RESEND_FROM_EMAIL` in Supabase.

API reference for the `from` field:  
[Send Email — `from` parameter](https://resend.com/docs/api-reference/emails/send-email)

### A4. Create API key

1. Resend → **API Keys** → **Create API Key**.
2. Name: e.g. `dirac-trial-cron`.
3. Permission: **Sending access** (full access is also fine).
4. Copy the key once — it starts with `re_`. This becomes `RESEND_API_KEY`.

### A5. Test send (optional)

Resend → **Emails** → send a test to yourself using the same **from** address you chose. If that works, your from-address is valid.

---

## Part B — Database migration (do this before cron)

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste contents of `supabase/migrations/20250602100000_trial_usage_reminders.sql`.
3. **Run**.

This adds usage counters and `trial_reminders_sent` on `public.users`.

---

## Part C — What “deploy the function” means

**Deploy** = upload the Edge Function code from your repo to **your Supabase project** so Supabase can execute it at:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/trial-reminder-emails
```

You deploy **once** after code changes (or when setting up for the first time). Vercel deploys do **not** deploy Edge Functions automatically unless you add a separate CI step.

### Option 1 — Supabase CLI (recommended)

**One-time: install CLI and link project**

```bash
# macOS
brew install supabase/tap/supabase

# login
supabase login

# from repo root
cd /path/to/Dirac-Web
supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is in the dashboard URL:  
`https://supabase.com/dashboard/project/sulelcdpqsxzrrbsuadl` → ref is `sulelcdpqsxzrrbsuadl`.

**Deploy the function**

```bash
cd /path/to/Dirac-Web
supabase functions deploy trial-reminder-emails --no-verify-jwt
```

- `trial-reminder-emails` = folder name under `supabase/functions/`.
- `--no-verify-jwt` = cron can call the URL with your custom secret instead of a user JWT (matches `supabase/config.toml`).

**Verify**

Dashboard → **Edge Functions** → you should see **trial-reminder-emails** with status deployed.

Or curl (after secrets exist):

```bash
curl -i -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/trial-reminder-emails" \
  -H "Authorization: Bearer YOUR_TRIAL_REMINDER_CRON_SECRET"
```

### Option 2 — Dashboard (if you prefer not to use CLI)

1. Dashboard → **Edge Functions** → **Deploy a new function** (or **Create function**).
2. Name: `trial-reminder-emails`.
3. Paste code from `supabase/functions/trial-reminder-emails/index.ts` (or connect GitHub deploy if enabled on your plan).
4. Deploy.

CLI is easier to keep in sync with git; use whichever your team already uses.

---

## Part D — Edge Function secrets (where and what)

Secrets are **environment variables** available only inside Edge Functions — **not** Vercel, **not** `.env.local` for Next.js (unless you duplicate them for local testing).

### Where to set them

**Supabase Dashboard:**

1. Open your project.
2. **Project Settings** (gear, bottom of left sidebar) → **Edge Functions** (or **Edge Functions** → **Secrets** on some layouts).
3. Section: **Secrets** / **Environment variables**.
4. Add each **name** + **value** → Save.

CLI alternative (same effect):

```bash
supabase secrets set RESEND_API_KEY=xxxxx
supabase secrets set RESEND_FROM_EMAIL="Dirac <billing@dirac.app>"
supabase secrets set APP_URL=https://app.dirac.app
supabase secrets set TRIAL_REMINDER_CRON_SECRET="xxxxx"
```

After `secrets set`, **redeploy** is usually not required, but if behavior is stale, run `supabase functions deploy trial-reminder-emails --no-verify-jwt` again.

### Each secret — where to get the value

| Secret name | Where to get it |
|-------------|-----------------|
| `SUPABASE_URL` | Dashboard → **Project Settings** → **API** → **Project URL** (e.g. `https://abcdefgh.supabase.co`). Often auto-injected; set manually if missing. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → **service_role** key (click reveal). **Never** put this in the browser or commit to git. Same as `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. |
| `RESEND_API_KEY` | Resend → **API Keys** → `re_...` |
| `RESEND_FROM_EMAIL` | You chose this in Part A3, e.g. `Dirac <billing@.dirac.app>` |
| `APP_URL` | Your live app URL with no trailing slash: `https://app.dirac.app` (used in upgrade links in emails) |
| `TRIAL_REMINDER_CRON_SECRET` | Generate yourself: `openssl rand -hex 32`. Any long random string. Used only so random people cannot hit your function URL. **Same value** must be used in the cron job `Authorization` header. |

---

## Part E — Daily cron (schedule)

The function does **nothing** until something **calls its URL once per day**. That caller is a **Cron job** in Supabase (built on `pg_cron` + `pg_net`).

### E1. Enable extensions (if needed)

Dashboard → **Database** → **Extensions**:

- `pg_cron` — **enabled**
- `pg_net` — **enabled**

### E2. Create cron job via Dashboard (easiest)

1. Dashboard → **Integrations** → **Cron** (or **Database** → **Cron Jobs**).
2. **Create job** / **New cron job**.
3. Fill in:
   - **Name:** `trial-reminder-emails-daily`
   - **Schedule:** `0 14 * * *`  
     Meaning: every day at **14:00 UTC**.  
     Use [crontab.guru](https://crontab.guru/#0_14_*_*_*) to pick another time (e.g. morning US = adjust UTC hour).
   - **Type:** **HTTP request** or **Supabase Edge Function** (wording varies).
   - **URL:**  
     `https://sulelcdpqsxzrrbsuadl.supabase.co/functions/v1/trial-reminder-emails`
   - **Method:** `POST`
   - **Headers** (add one header):
     - `Authorization`: `Bearer YOUR_TRIAL_REMINDER_CRON_SECRET`  
       (paste the **exact** secret from Part D, including the word `Bearer` + space before the token)
     - `Content-Type`: `application/json` (optional)
   - **Body:** `{}` or empty JSON object.
4. **Save** / **Create**.

### E2b. Create cron job via SQL (same thing)

SQL Editor → run (replace placeholders):

```sql
-- Enable if not already
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'trial-reminder-emails-daily',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/trial-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_TRIAL_REMINDER_CRON_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
```

Replace:

- `YOUR_PROJECT_REF`
- `YOUR_TRIAL_REMINDER_CRON_SECRET` (no extra quotes inside the Bearer string)

### E3. Confirm it ran

- **Cron:** Integrations → Cron → job history / `cron.job_run_details`
- **Function:** Edge Functions → **trial-reminder-emails** → **Logs**

Successful run returns JSON like `{ "date": "2026-06-02", "processed": N, "results": [...] }`.

### E4. Manual test (anytime)

```bash
curl -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/trial-reminder-emails" \
  -H "Authorization: Bearer YOUR_TRIAL_REMINDER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Part F — When emails actually send

On each daily run, for each user with `trial_start_date` set and `subscription_status != 'active'`:

| Days since `trial_start_date` (UTC date) | Reminder key | Typical meaning |
|----------------------------------------|--------------|-----------------|
| 12 | `day_12` | 2 days before 14-day trial ends |
| 14 | `day_14` | Last trial day |
| 15 | `day_15` | Day after trial ended |

Each key is sent **once** (stored in `trial_reminders_sent`).

---

## Part G — Stripe / Vercel (unchanged)

- **Vercel:** `STRIPE_*`, `NEXT_PUBLIC_APP_URL` — checkout & webhooks (no Resend on Vercel).
- **Stripe trial reminder emails (day 3 / day 1):** not used; Dirac trial is on `users.trial_start_date`. Leave Stripe’s trial emails off to avoid duplicates.

---

## Checklist

- [ ] Resend domain **verified**
- [ ] `RESEND_FROM_EMAIL` uses that domain
- [ ] Migration `20250602100000_trial_usage_reminders.sql` applied
- [ ] Edge Function **deployed** (`trial-reminder-emails`)
- [ ] All **secrets** set in Supabase
- [ ] **Cron job** daily with correct URL + `Authorization: Bearer …`
- [ ] Manual `curl` test returns 200
- [ ] Resend dashboard shows sent messages after a test day match

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` on curl | Wrong `TRIAL_REMINDER_CRON_SECRET` or missing `Bearer ` prefix |
| Resend `403` / domain error | From address not on verified domain |
| No emails but 200 JSON | No user’s `trial_start_date` matches today−12/14/15 UTC |
| Function not in dashboard | Run `supabase functions deploy …` or create via UI |
| Emails only to you | Resend sandbox — verify domain for all recipients |
