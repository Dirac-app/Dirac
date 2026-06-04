import type { User } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import {
  getUserById,
  insertMinimalUser,
  completeTrialSetup,
  type EmailVolume,
  type MainPainPoint,
} from "@/lib/users-db";

function displayNameFromAuthUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  return name;
}

/**
 * Ensures a public.users row exists (no Stripe yet — that runs on onboarding setup).
 */
export async function ensureUserRowIfNeeded(authUser: User): Promise<void> {
  const existing = await getUserById(authUser.id);
  if (existing) return;

  const email = authUser.email;
  if (!email) {
    throw new Error("Authenticated user is missing an email address");
  }

  await insertMinimalUser({
    id: authUser.id,
    email,
    name: displayNameFromAuthUser(authUser),
  });
}

/**
 * Onboarding Screen 3: Stripe customer + trial clock start.
 */
export async function runOnboardingSetup(authUserId: string): Promise<void> {
  const existing = await getUserById(authUserId);
  if (!existing) {
    throw new Error("User row not found");
  }

  if (existing.stripe_customer_id && existing.trial_start_date) {
    return;
  }

  const stripe = getStripe();
  let customerId = existing.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: existing.email,
      name: existing.name ?? undefined,
      metadata: { supabase_user_id: authUserId },
    });
    customerId = customer.id;
  }

  await completeTrialSetup(authUserId, customerId);
}

/** @deprecated Use ensureUserRowIfNeeded + runOnboardingSetup */
export async function provisionUserIfNeeded(authUser: User): Promise<void> {
  await ensureUserRowIfNeeded(authUser);
  const row = await getUserById(authUser.id);
  if (row && !row.stripe_customer_id) {
    await runOnboardingSetup(authUser.id);
  }
}

export type { EmailVolume, MainPainPoint };
