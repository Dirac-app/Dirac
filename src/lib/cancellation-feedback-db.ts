import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CancellationCancelType = "immediate" | "at_period_end";

export async function insertCancellationFeedback(input: {
  userId: string;
  reason?: string | null;
  improvement?: string | null;
  comeback?: string | null;
  planStatus: string;
  cancelType: CancellationCancelType;
  cancelAt?: string | null;
  stripeSubscriptionId?: string | null;
  source?: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cancellation_feedback").insert({
    user_id: input.userId,
    reason: input.reason?.trim() || null,
    improvement: input.improvement?.trim() || null,
    comeback: input.comeback?.trim() || null,
    plan_status: input.planStatus,
    cancel_type: input.cancelType,
    cancel_at: input.cancelAt ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    source: input.source ?? "account",
  });
  if (error) throw error;
}
