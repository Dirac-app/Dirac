-- Add role field for signup onboarding question

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_role TEXT;

COMMENT ON COLUMN public.users.user_role IS
  'founder_ceo | operator | sales | product_engineering | investor | other';
