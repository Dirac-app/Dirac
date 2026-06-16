import type Stripe from "stripe";
import {
  type BillingPlan,
  promoPlanMismatchMessage,
} from "@/lib/stripe-promo-config";

export type ResolvedPromotionCode = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: Stripe.Coupon.Duration | null;
  durationInMonths: number | null;
  appliesToProductIds: string[];
};

function couponFromPromo(promo: Stripe.PromotionCode): Stripe.Coupon | null {
  const coupon = promo.promotion.coupon;
  return typeof coupon === "string" ? null : coupon;
}

/** Resolve a customer-facing promo code string to an active Stripe promotion code. */
export async function resolvePromotionCode(
  stripe: Stripe,
  rawCode: string,
): Promise<ResolvedPromotionCode | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const { data } = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon"],
  });

  const promo = data[0];
  if (!promo || !promo.active) return null;

  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return null;
  if (
    typeof promo.max_redemptions === "number" &&
    promo.times_redeemed >= promo.max_redemptions
  ) {
    return null;
  }

  const coupon = couponFromPromo(promo);

  return {
    id: promo.id,
    code: promo.code,
    percentOff: coupon?.percent_off ?? null,
    amountOff: coupon?.amount_off ?? null,
    currency: coupon?.currency ?? null,
    duration: coupon?.duration ?? null,
    durationInMonths: coupon?.duration_in_months ?? null,
    appliesToProductIds: coupon?.applies_to?.products ?? [],
  };
}

export async function validatePromoForCheckout(
  stripe: Stripe,
  promo: ResolvedPromotionCode,
  plan: BillingPlan,
  priceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mismatch = promoPlanMismatchMessage(promo.code, plan);
  if (mismatch) return { ok: false, error: mismatch };

  if (promo.appliesToProductIds.length > 0) {
    const price = await stripe.prices.retrieve(priceId);
    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;
    if (productId && !promo.appliesToProductIds.includes(productId)) {
      return {
        ok: false,
        error: `This promo code doesn't apply to the ${plan} plan.`,
      };
    }
  }

  return { ok: true };
}

function formatDiscountAmount(promo: ResolvedPromotionCode): string | null {
  if (promo.percentOff) return `${promo.percentOff}% off`;
  if (promo.amountOff && promo.currency) {
    const amount = (promo.amountOff / 100).toLocaleString("en-US", {
      style: "currency",
      currency: promo.currency.toUpperCase(),
    });
    return `${amount} off`;
  }
  return null;
}

function formatDuration(promo: ResolvedPromotionCode): string | null {
  if (promo.duration === "once") return "first invoice";
  if (promo.duration === "forever") return "ongoing";
  if (promo.duration === "repeating" && promo.durationInMonths) {
    const n = promo.durationInMonths;
    return `${n} month${n === 1 ? "" : "s"}`;
  }
  return null;
}

export function formatPromotionSummary(promo: ResolvedPromotionCode): string {
  const discount = formatDiscountAmount(promo);
  const duration = formatDuration(promo);
  if (discount && duration) return `${discount} for ${duration}`;
  if (discount) return discount;
  return "Discount applied";
}
