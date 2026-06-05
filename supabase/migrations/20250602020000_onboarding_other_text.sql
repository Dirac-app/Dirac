-- Free-text when user picks "other" on signup questions

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_role_other TEXT,
  ADD COLUMN IF NOT EXISTS email_volume_other TEXT,
  ADD COLUMN IF NOT EXISTS main_pain_point_other TEXT;
