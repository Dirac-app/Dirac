-- Trial usage counters + idempotent reminder tracking

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS emails_processed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_drafts_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_reminders_sent TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.users.emails_processed_count IS 'Emails sent via Dirac during trial (Gmail/Outlook send)';
COMMENT ON COLUMN public.users.ai_drafts_count IS 'AI-generated reply drafts during trial';
COMMENT ON COLUMN public.users.trial_reminders_sent IS 'Sent trial reminder keys: day_12, day_14, day_15';

CREATE OR REPLACE FUNCTION public.increment_user_usage(
  p_user_id UUID,
  p_emails INTEGER DEFAULT 0,
  p_ai_drafts INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    emails_processed_count = emails_processed_count + GREATEST(p_emails, 0),
    ai_drafts_count = ai_drafts_count + GREATEST(p_ai_drafts, 0)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_usage(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_usage(UUID, INTEGER, INTEGER) TO service_role;
