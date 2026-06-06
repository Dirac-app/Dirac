-- Trial conversion feedback (from emails, upgrade wall, etc.)

CREATE TABLE IF NOT EXISTS public.trial_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('continuing', 'not_continuing', 'undecided')),
  message TEXT NOT NULL CHECK (char_length(trim(message)) >= 3),
  reminder_key TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trial_feedback_user_id_idx ON public.trial_feedback (user_id);
CREATE INDEX IF NOT EXISTS trial_feedback_created_at_idx ON public.trial_feedback (created_at DESC);

ALTER TABLE public.trial_feedback ENABLE ROW LEVEL SECURITY;

-- Inserts via service role API only; no client policies.
