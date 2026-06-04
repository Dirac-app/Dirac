import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
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

  const appUser = await getUserById(authUser.id);
  if (!appUser?.stripe_customer_id) {
    return NextResponse.json({ error: "Billing account not found" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
  const session = await stripe.checkout.sessions.create({
    customer: appUser.stripe_customer_id,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/inbox?billing=success`,
    cancel_url: `${origin}/upgrade?billing=cancelled`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
