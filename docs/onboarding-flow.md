# Signup onboarding flow

Four-screen flow at `/signup` (no full page reloads between screens). See `src/components/signup/signup-flow.tsx`.

## Supabase migration

Run after `20250601000000_users_billing.sql`:

```bash
supabase/migrations/20250602000000_onboarding_fields.sql
```

Adds: `email_volume`, `main_pain_point`, `shown_tooltips` (jsonb), `onboarding_completed_at`.

## Env vars

No new variables beyond existing auth/billing setup (`GOOGLE_*`, `NEXTAUTH_*`, `SUPABASE_*`, `STRIPE_*`).

## Manual configuration

Same as [supabase-setup.md](./supabase-setup.md) and [stripe-setup.md](./stripe-setup.md):

- Google OAuth redirect: `http://localhost:3000/api/auth/callback/google`
- Supabase Google provider Client ID must match `GOOGLE_CLIENT_ID`
- Supabase redirect URL: `http://localhost:3000/auth/callback`
