import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Best-effort usage counters on public.users (no-op if user id is not a Supabase UUID). */
export function incrementUserUsage(
  userId: string | null | undefined,
  delta: { emails?: number; aiDrafts?: number },
): void {
  if (!userId || !UUID_RE.test(userId)) return;
  const emails = delta.emails ?? 0;
  const aiDrafts = delta.aiDrafts ?? 0;
  if (emails === 0 && aiDrafts === 0) return;

  const supabase = createSupabaseAdminClient();
  void supabase.rpc("increment_user_usage", {
    p_user_id: userId,
    p_emails: emails,
    p_ai_drafts: aiDrafts,
  });
}
