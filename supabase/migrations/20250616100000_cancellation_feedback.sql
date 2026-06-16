-- Offboarding survey responses when users cancel their subscription.

CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reason TEXT,
  improvement TEXT,
  comeback TEXT,
  plan_status TEXT NOT NULL,
  cancel_type TEXT NOT NULL CHECK (cancel_type IN ('immediate', 'at_period_end')),
  cancel_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  source TEXT NOT NULL DEFAULT 'account',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cancellation_feedback_user_id_idx
  ON public.cancellation_feedback (user_id);

CREATE INDEX IF NOT EXISTS cancellation_feedback_created_at_idx
  ON public.cancellation_feedback (created_at DESC);

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

-- Inserts via service role API only; no client policies.
