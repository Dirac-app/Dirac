-- Track welcome email delivery (idempotent send after trial checkout).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
