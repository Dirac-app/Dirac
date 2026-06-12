-- Persistent sender history cache, populated by background Gmail sync.
-- Stores accurate first/last seen dates regardless of how many threads are
-- loaded in memory on the client.

CREATE TABLE IF NOT EXISTS public.sender_stats (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  email          text        NOT NULL,
  name           text,
  first_seen_at  timestamptz NOT NULL,
  last_seen_at   timestamptz NOT NULL,
  thread_count   integer     NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS sender_stats_user_id_idx ON public.sender_stats (user_id);
CREATE INDEX IF NOT EXISTS sender_stats_last_seen_idx ON public.sender_stats (user_id, last_seen_at DESC);

ALTER TABLE public.sender_stats ENABLE ROW LEVEL SECURITY;

-- Users can only read their own sender stats.
-- Writes are performed server-side with the service role key.
CREATE POLICY "Users read own sender stats"
  ON public.sender_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
