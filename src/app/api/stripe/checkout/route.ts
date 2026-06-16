import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { resolvePromotionCode } from "@/lib/stripe-promo";
import { getUserById } from "@/lib/users-db";

const PLANS = {
  monthly: "STRIPE_MONTHLY_PRICE_ID",
  annual: "STRIPE_ANNUAL_PRICE_ID",
} as const;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");
  // signup=true: create customer if needed, add trial period, use signup redirect URLs
  const isSignup = searchParams.get("signup") === "true";

  let promoCodeInput: string | undefined;
  try {
    const body = (await request.json()) as { promoCode?: string };
    promoCodeInput = body.promoCode?.trim();
  } catch {
    promoCodeInput = searchParams.get("promo")?.trim() || undefined;
  }

  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const appUser = await getUserById(authUser.id);
  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  if (!isSignup && !appUser.stripe_customer_id) {
    return NextResponse.json({ error: "Billing account not found" }, { status: 400 });
  }

  const envKey = PLANS[plan];
  const priceId = process.env[envKey];
  if (!priceId) {
    return NextResponse.json({ error: `${envKey} is not configured` }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    new URL(request.url).origin;

  const stripe = getStripe();

  // For signup: create customer now so we have the ID for metadata
  let customerId = appUser.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: appUser.email,
      name: appUser.name ?? undefined,
      metadata: { supabase_user_id: authUser.id },
    });
    customerId = customer.id;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { supabase_user_id: authUser.id },
  };

  if (promoCodeInput) {
    const promo = await resolvePromotionCode(stripe, promoCodeInput);
    if (!promo) {
      return NextResponse.json(
        { error: "Invalid or expired promo code" },
        { status: 400 },
      );
    }
    sessionParams.discounts = [{ promotion_code: promo.id }];
  }

  if (isSignup) {
    sessionParams.subscription_data = {
      trial_period_days: 7,
      metadata: { supabase_user_id: authUser.id },
    };
    sessionParams.success_url = `${origin}/signup?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    sessionParams.cancel_url = `${origin}/signup?payment=cancelled`;
  } else {
    sessionParams.success_url = `${origin}/inbox?billing=success`;
    sessionParams.cancel_url = `${origin}/upgrade?billing=cancelled`;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
