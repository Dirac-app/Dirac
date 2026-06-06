import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TrialFeedbackDecision = "continuing" | "not_continuing" | "undecided";

export async function insertTrialFeedback(input: {
  userId: string;
  decision: TrialFeedbackDecision;
  message: string;
  reminderKey?: string | null;
  source?: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("trial_feedback").insert({
    user_id: input.userId,
    decision: input.decision,
    message: input.message.trim(),
    reminder_key: input.reminderKey ?? null,
    source: input.source ?? "web",
  });
  if (error) throw error;
}
