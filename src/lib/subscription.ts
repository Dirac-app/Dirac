import {
  getUserById,
  updateSubscriptionStatus,
  type AppUser,
  type SubscriptionStatus,
} from "@/lib/users-db";

export const TRIAL_DAYS = 7;

export function isTrialExpired(trialStartDate: string): boolean {
  const start = new Date(trialStartDate).getTime();
  const cutoff = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > cutoff;
}

/**
 * Returns the effective subscription status, expiring trials when past 14 days.
 */
export async function resolveSubscriptionStatus(user: AppUser): Promise<SubscriptionStatus> {
  if (user.subscription_status === "active") return "active";
  if (user.subscription_status === "expired") return "expired";

  if (
    user.subscription_status === "trialing" &&
    user.trial_start_date &&
    isTrialExpired(user.trial_start_date)
  ) {
    await updateSubscriptionStatus(user.id, "expired");
    return "expired";
  }

  return user.subscription_status;
}

export async function getEffectiveSubscriptionStatus(
  userId: string,
): Promise<SubscriptionStatus | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  return resolveSubscriptionStatus(user);
}

export function requiresUpgrade(status: SubscriptionStatus): boolean {
  return status === "expired";
}
