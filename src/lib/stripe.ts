import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Period end timestamp (seconds) — Stripe v22+ exposes this on subscription items. */
export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): number | null {
  const fromItem = subscription.items.data[0]?.current_period_end;
  if (typeof fromItem === "number") return fromItem;
  if (typeof subscription.cancel_at === "number") return subscription.cancel_at;
  return null;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}
