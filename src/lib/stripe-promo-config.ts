export type BillingPlan = "monthly" | "annual";

/** Default codes — override with env vars only if you rename them in Stripe. */
export const DEFAULT_MONTHLY_PROMO_CODE = "TRYDIRAC50";
export const DEFAULT_ANNUAL_PROMO_CODE = "TRYDIRAC25";

export function promoCodeForPlan(plan: BillingPlan): string {
  if (plan === "monthly") {
    return process.env.STRIPE_MONTHLY_PROMO_CODE ?? DEFAULT_MONTHLY_PROMO_CODE;
  }
  return process.env.STRIPE_ANNUAL_PROMO_CODE ?? DEFAULT_ANNUAL_PROMO_CODE;
}

export function planForPromoCode(code: string): BillingPlan | null {
  const normalized = code.trim().toUpperCase();
  if (normalized === promoCodeForPlan("monthly").toUpperCase()) return "monthly";
  if (normalized === promoCodeForPlan("annual").toUpperCase()) return "annual";
  return null;
}

export function promoPlanMismatchMessage(code: string, plan: BillingPlan): string | null {
  const assigned = planForPromoCode(code);
  if (!assigned || assigned === plan) return null;
  if (assigned === "monthly") {
    return `${promoCodeForPlan("monthly")} is for the monthly plan. Use ${promoCodeForPlan("annual")} for annual.`;
  }
  return `${promoCodeForPlan("annual")} is for the annual plan. Use ${promoCodeForPlan("monthly")} for monthly.`;
}
