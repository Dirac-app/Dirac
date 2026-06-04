-- Users & billing schema for Dirac
-- Run in Supabase SQL Editor or via `supabase db push`

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

-- Inserts/updates for billing are performed server-side with the service role key.
