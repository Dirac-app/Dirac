-- Onboarding fields on public.users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_volume TEXT,
  ADD COLUMN IF NOT EXISTS main_pain_point TEXT,
  ADD COLUMN IF NOT EXISTS shown_tooltips JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.email_volume IS 'under_50 | 50_200 | 200_plus';
COMMENT ON COLUMN public.users.main_pain_point IS 'volume | replies | missing_important';
COMMENT ON COLUMN public.users.shown_tooltips IS 'Dismissed inbox tooltip ids, e.g. ["morning_brief","ai_sidebar"]';
