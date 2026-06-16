# Stripe setup for Dirac

This guide configures Stripe for **Dirac Web** (`app.dirac.app`): subscription billing via **Hosted Checkout**, customers created on sign-up, and webhooks that update `public.users.subscription_status` in Supabase.

Dirac is **standard B2C SaaS** on **your** Stripe account. You are **not** using Stripe Connect (no marketplace, no paying out to connected accounts).

---

## What Dirac expects

| Piece | Behavior |
|-------|----------|
| **Sign-up** | Server creates a Stripe **Customer** (`cus_...`) and stores `stripe_customer_id` on `public.users` |
| **Trial** | **14 days in the app** (`trial_start_date` + proxy gating), not a Stripe trial period |
| **Upgrade** | `/upgrade` → `POST /api/stripe/checkout?plan=monthly\|annual` → redirect to `checkout.stripe.com` |
| **Active** | Webhook `invoice.paid` → `subscription_status = active` |
| **Expired** | Webhook `customer.subscription.deleted` → `subscription_status = expired` |

**Env vars (server only — no Stripe publishable key):**

```bash
STRIPE_SECRET_KEY=sk_test_...          # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # per webhook endpoint (test vs live differ)
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://app.dirac.app   # Checkout success/cancel URLs
```

Code: `src/lib/stripe.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/lib/provision-user.ts`.

---

## 1. Create / open your Stripe account

1. [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register) (or sign in).
2. Complete business profile when you are ready for **live** charges (you can develop in **test mode** first).
3. **Do not enable Stripe Connect** unless you later build a marketplace. Dirac does not use it today.

---

## 2. Test mode vs live mode

Use the **Test mode** toggle (top right of the Dashboard).

| Mode | Secret key prefix | When |
|------|-------------------|------|
| **Test** | `sk_test_...` | Local dev, staging |
| **Live** | `sk_live_...` | Production (`app.dirac.app`) |

Rules:

- Test customers, prices, and webhooks are **separate** from live.
- Use **test** Price IDs in `.env.local` and **live** Price IDs on Vercel production.
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

---

## 3. Create products and prices

Dirac Checkout uses **Price IDs** (`price_...`), not ad-hoc amounts.

### Monthly — $20/mo

1. **Product catalog** → **+ Add product**.
2. **Name**: `Dirac Monthly` (customer-facing name on invoices).
3. **Pricing**:
   - **Recurring**
   - **$20.00 USD** (adjust currency if needed)
   - **Monthly**
4. Save → open the price → copy **Price ID** → `STRIPE_MONTHLY_PRICE_ID`.

### Annual — $200/yr

1. **+ Add product** → **Name**: `Dirac Annual`.
2. **Pricing**:
   - **Recurring**
   - **$200.00 USD**
   - **Yearly**
3. Copy **Price ID** → `STRIPE_ANNUAL_PRICE_ID`.

### Recommended product settings

- **Tax**: Configure [Stripe Tax](https://dashboard.stripe.com/tax) or tax behavior on prices if you need sales tax/VAT.
- **Customer portal** (optional, §8): lets users cancel/update payment method without you building UI.

Repeat steps in **live mode** before launch and use live `price_...` IDs in production env.

---

## 3b. Promo codes

Dirac has **two plan-specific codes** (configured in Stripe — no extra env vars required):

| Plan | Code | Discount |
|------|------|----------|
| **Monthly** | `TRYDIRAC50` | 50% off for **2 months** |
| **Annual** | `TRYDIRAC25` | 25% off (**first year** invoice) |

The app validates that each code is used with the matching plan. Wrong combo → clear error before Checkout.

Optional env overrides (only if you rename codes in Stripe):

```bash
STRIPE_MONTHLY_PROMO_CODE=TRYDIRAC50
STRIPE_ANNUAL_PROMO_CODE=TRYDIRAC25
```

### Monthly coupon — `TRYDIRAC50`

1. [Stripe → Coupons](https://dashboard.stripe.com/coupons) → **+ New**.
2. **50%** off · **Duration**: **Repeating** → **2 months**.
3. **Apply to specific products** → select **Dirac Monthly** only (recommended).
4. **Promotion codes** → add code `TRYDIRAC50`.

### Annual coupon — `TRYDIRAC25`

1. **+ New** coupon.
2. **25%** off · **Duration**: **Once** (first invoice after trial).
3. **Apply to specific products** → select **Dirac Annual** only (recommended).
4. **Promotion codes** → add code `TRYDIRAC25`.

Repeat both in **live mode** before sharing publicly.

### After the 7-day trial

| Plan | With code | Then |
|------|-----------|------|
| Monthly + `TRYDIRAC50` | $10/mo for 2 months | $20/mo |
| Annual + `TRYDIRAC25` | $150 first year | $200/yr on renewal |

Codes are looked up from Stripe at runtime — the string name only needs to match what you created in the Dashboard.

---

## 4. API keys (secret only)

Dirac does **not** use `pk_test_...` / `pk_live_...` because payment UI runs on **Stripe Hosted Checkout**, not Stripe.js in the browser.

1. **Developers** → **API keys**.
2. Copy **Secret key** → `STRIPE_SECRET_KEY`.

### Restricted keys (optional)

For production you may create a **restricted key** with only:

- Customers — Write  
- Checkout Sessions — Write  
- Subscriptions — Read (optional, debugging)  
- Webhook endpoints — Read (optional)

The app’s server uses the secret key for `customers.create` and `checkout.sessions.create`.

**Never** commit keys. Set them in `.env.local` and Vercel **Environment Variables**.

---

## 5. Webhook / event destination (important)

### Events from: **Your account** (not Connected accounts)

When Stripe asks **where events come from** (Workbench: **Events from** / **Listen to**):

| Option | Use for Dirac? |
|--------|----------------|
| **Your account** | **Yes** — charges and subscriptions on your platform account |
| **Connected accounts** | **No** — only if you use Stripe Connect and need events from sellers’ connected accounts |

Dirac creates **Customers** and **Subscriptions** on **your** account with your `sk_...` key. Choose **Your account**.

If you only see “Connected accounts” destinations, you are likely in a Connect-focused flow — go to **Developers** → **Webhooks** (or Workbench → **Webhooks**) and create a destination for **your** account.

### Destination type: **Webhook endpoint** (HTTPS)

Not EventBridge/Azure unless you intentionally use those.

| Field | Value |
|-------|--------|
| **Endpoint URL (production)** | `https://app.dirac.app/api/stripe/webhook` |
| **Endpoint URL (local)** | Use Stripe CLI (§7), not a public URL |

### API version

Leave **default account API version** unless you have a reason to pin. Dirac uses the Stripe Node SDK default.

### Events to subscribe to

Subscribe only to what the app handles (keeps noise and failures down):

| Event | Required | Why |
|-------|----------|-----|
| `invoice.paid` | **Yes** | First payment and renewals → set `active` |
| `customer.subscription.deleted` | **Yes** | Cancel / end of subscription → set `expired` |

You do **not** need (for current code):

- `checkout.session.completed` — not handled (activation is via `invoice.paid`)
- `customer.subscription.updated` — not handled
- `invoice.payment_failed` — not handled (optional later for dunning)

In the Dashboard event picker, search for those two names and select them.

### Signing secret

After creating the destination, open it and reveal **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

- **Test** destination → `whsec_...` for local / staging.  
- **Live** destination → different `whsec_...` for production.

### Snapshot vs thin events

Use default **snapshot** events for `invoice.paid` and `customer.subscription.deleted` (standard webhook payloads). Dirac reads `invoice.customer` and `subscription.customer` from the event object.

---

## 6. Environment variables

### Local (`.env.local`)

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...          # from test webhook OR stripe listen (§7)
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

Also ensure Supabase keys are set ([supabase-setup.md](./supabase-setup.md)) so sign-up can create customers.

### Production (Vercel)

Same keys with **live** values:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...          # from LIVE webhook destination only
STRIPE_MONTHLY_PRICE_ID=price_...        # live prices
STRIPE_ANNUAL_PRICE_ID=price_...

NEXT_PUBLIC_APP_URL=https://app.dirac.app
```

Redeploy after changing env vars.

---

## 7. Local development (Stripe CLI)

Dashboard webhooks cannot hit `localhost`. Use the CLI:

```bash
# Install: https://stripe.com/docs/stripe-cli
brew install stripe/stripe-cli/stripe

stripe login

# Forward test events to your app
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a **webhook signing secret** (`whsec_...`). Put **that** in `.env.local` as `STRIPE_WEBHOOK_SECRET` while developing locally (not necessarily the Dashboard test endpoint secret).

Trigger test events:

```bash
# After a test checkout, or simulate:
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

Run `npm run dev` and ensure `STRIPE_SECRET_KEY` is **test** mode.

---

## 8. Optional: Customer Billing Portal

Lets users cancel or update card without custom UI.

1. **Settings** → **Billing** → **Customer portal**.
2. Enable portal, allow **cancel subscription** and **update payment method**.
3. Link from Settings later via [Billing Portal Session API](https://docs.stripe.com/api/customer_portal/sessions/create) (not in Dirac MVP yet).

Cancellations still fire `customer.subscription.deleted` → Dirac marks `expired`.

---

## 9. End-to-end flow (verify)

### A. Customer on sign-up

1. Sign in at `/signup` (Supabase Google).
2. Supabase `public.users` row should include `stripe_customer_id` (`cus_...`).
3. Stripe Dashboard → **Customers** → same email.

If `stripe_customer_id` is null, check `STRIPE_SECRET_KEY` and server logs from `/auth/callback`.

### B. Checkout

1. Set trial to expired in DB **or** wait 14 days → visit `/upgrade`.
2. Click **Monthly** or **Annual**.
3. Complete Checkout with test card.
4. Redirect to `/inbox?billing=success`.

### C. Webhook → active

1. **Developers** → **Webhooks** → your endpoint → **Event deliveries**.
2. Latest `invoice.paid` should be **200** from your app.
3. Supabase:

```sql
SELECT email, subscription_status, stripe_customer_id
FROM public.users
WHERE email = 'you@example.com';
```

Expect `subscription_status = active`.

### D. Cancel → expired

1. Stripe Dashboard → **Customers** → subscription → **Cancel**.
2. Confirm `customer.subscription.deleted` delivered (200).
3. `subscription_status` should be `expired`; visiting `/inbox` redirects to `/upgrade`.

---

## 10. Production checklist

- [ ] Business details and payout bank added (Stripe **Activate account**).
- [ ] **Live mode** products/prices created; live `price_...` in Vercel.
- [ ] **Live** `sk_live_...` in Vercel only (never in git).
- [ ] Event destination: **Your account**, URL `https://app.dirac.app/api/stripe/webhook`.
- [ ] Events: `invoice.paid`, `customer.subscription.deleted` only (minimum).
- [ ] Live `whsec_...` in Vercel `STRIPE_WEBHOOK_SECRET`.
- [ ] `NEXT_PUBLIC_APP_URL=https://app.dirac.app`.
- [ ] Test purchase in live mode with a real card (small amount), then refund if needed.
- [ ] Webhook delivery log shows 200s.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Webhook **400** Invalid signature | Wrong `STRIPE_WEBHOOK_SECRET` | Local: use CLI `whsec`. Prod: use that endpoint’s secret. Test vs live must match. |
| Webhook **500** | Supabase / DB error | Check Vercel logs; confirm `users` table and `SUPABASE_SECRET_KEY`. |
| Checkout **500** `price_` not configured | Missing env | Set `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID`. |
| Checkout **400** Billing account not found | No `stripe_customer_id` | Re-sign-up or fix provisioning; `STRIPE_SECRET_KEY` must work on callback. |
| Paid in Stripe, still `trialing` | Webhook not received or wrong scope | Scope = **Your account**; confirm `invoice.paid` subscribed and 200 delivery. |
| Events never arrive locally | No public URL | Use `stripe listen`, not Dashboard URL to localhost. |
| Test key with live price ID | Mode mismatch | Keys, prices, and webhooks must all be test **or** all live. |
| Used **Connected accounts** scope | Wrong destination | Recreate destination for **Your account**. |

---

## 12. When you would use “Connected accounts”

Only if Dirac became a **platform** billing on behalf of other businesses (Stripe Connect). Then you would:

- Onboard connected accounts,
- Create **Connect** charges or destination charges,
- Add a **second** webhook destination with **Connected accounts** scope for seller-specific events.

That is **out of scope** for the current app. Use **Your account** only.

---

## 13. Security notes

- Rotate `STRIPE_SECRET_KEY` and webhook secrets if leaked.
- Do not log full webhook bodies in production (PII).
- Webhook handler should stay **idempotent** (replaying `invoice.paid` is safe today: sets `active` again).

---

## Related docs

- [supabase-setup.md](./supabase-setup.md) — Auth, `users` table, Supabase keys  
- [.env.local.example](../.env.local.example) — Env template  
