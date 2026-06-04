import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SubscriptionStatus = "trialing" | "active" | "expired";
export type UserRole = "founder_ceo" | "operator" | "sales" | "product_engineering" | "investor" | "other";
export type EmailVolume = "receipts" | "cold_outreach" | "internal_investor" | "other";
export type MainPainPoint = "volume" | "replies" | "missing_important" | "other";
export type InboxTooltipId = "morning_brief" | "ai_sidebar";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  trial_start_date: string | null;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  user_role: UserRole | null;
  email_volume: EmailVolume | null;
  main_pain_point: MainPainPoint | null;
  shown_tooltips: string[];
  onboarding_completed_at: string | null;
}

function mapUser(row: Record<string, unknown>): AppUser {
  const tooltips = row.shown_tooltips;
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string | null) ?? null,
    created_at: row.created_at as string,
    trial_start_date: (row.trial_start_date as string | null) ?? null,
    subscription_status: row.subscription_status as SubscriptionStatus,
    stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
    user_role: (row.user_role as UserRole | null) ?? null,
    email_volume: (row.email_volume as EmailVolume | null) ?? null,
    main_pain_point: (row.main_pain_point as MainPainPoint | null) ?? null,
    shown_tooltips: Array.isArray(tooltips) ? (tooltips as string[]) : [],
    onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
  };
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapUser(data) : null;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<AppUser | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapUser(data) : null;
}

export async function insertMinimalUser(row: {
  id: string;
  email: string;
  name: string | null;
}): Promise<AppUser> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: row.id,
      email: row.email,
      name: row.name,
      subscription_status: "trialing",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapUser(data);
}

export async function completeTrialSetup(userId: string, stripeCustomerId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      stripe_customer_id: stripeCustomerId,
      trial_start_date: new Date().toISOString(),
      subscription_status: "trialing",
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateOnboardingAnswers(
  userId: string,
  answers: { user_role: UserRole; email_volume: EmailVolume; main_pain_point: MainPainPoint },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      user_role: answers.user_role,
      email_volume: answers.email_volume,
      main_pain_point: answers.main_pain_point,
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function dismissTooltip(userId: string, tooltipId: InboxTooltipId): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const next = Array.from(new Set([...user.shown_tooltips, tooltipId]));
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("users").update({ shown_tooltips: next }).eq("id", userId);
  if (error) throw error;
}

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ subscription_status: status })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateSubscriptionStatusByStripeCustomer(
  stripeCustomerId: string,
  status: SubscriptionStatus,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ subscription_status: status })
    .eq("stripe_customer_id", stripeCustomerId);
  if (error) throw error;
}
