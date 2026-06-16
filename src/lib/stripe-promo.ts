import type Stripe from "stripe";

export type ResolvedPromotionCode = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: Stripe.Coupon.Duration | null;
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
  };
}

export function formatPromotionSummary(promo: ResolvedPromotionCode): string {
  if (promo.percentOff) return `${promo.percentOff}% off`;
  if (promo.amountOff && promo.currency) {
    const amount = (promo.amountOff / 100).toLocaleString("en-US", {
      style: "currency",
      currency: promo.currency.toUpperCase(),
    });
    return `${amount} off`;
  }
  return "Discount applied";
}
