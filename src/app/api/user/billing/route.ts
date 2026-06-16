import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { getUserById } from "@/lib/users-db";
import { getStripe, getSubscriptionPeriodEnd } from "@/lib/stripe";

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function GET() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  const user = await getUserById(auth.user.id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Derived trial info from Supabase
  const trialStartDate = user.trial_start_date ? new Date(user.trial_start_date) : null;
  const trialEndDate = trialStartDate ? new Date(trialStartDate.getTime() + 7 * 86_400_000) : null;
  const trialDaysRemaining = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / 86_400_000))
    : null;

  let planInterval: "monthly" | "annual" | null = null;
  let currentPeriodEnd: string | null = null;
  let currentPeriodEndRaw: number | null = null;
  let stripeStatus: string | null = null;
  let cancelAtPeriodEnd = false;
  let priceAmount: number | null = null;   // in cents
  let priceCurrency: string | null = null;
  let subscriptionCreated: string | null = null;
  let invoiceUrl: string | null = null;

  if (user.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: "all",
        limit: 5,
        expand: ["data.latest_invoice"],
      });
      const active = subs.data.find(
        (s) => s.status === "active" || s.status === "trialing",
      );
      if (active) {
        stripeStatus = active.status;
        cancelAtPeriodEnd = active.cancel_at_period_end;
        const periodEnd = getSubscriptionPeriodEnd(active);
        currentPeriodEndRaw = periodEnd;
        currentPeriodEnd = periodEnd ? fmt(periodEnd) : null;
        subscriptionCreated = active.created ? fmt(active.created) : null;

        const price = active.items.data[0]?.price;
        if (price?.recurring?.interval === "year") planInterval = "annual";
        else if (price?.recurring?.interval === "month") planInterval = "monthly";

        if (typeof price?.unit_amount === "number") priceAmount = price.unit_amount;
        priceCurrency = price?.currency ?? null;

        // Latest invoice hosted URL for receipt
        const inv = active.latest_invoice;
        if (inv && typeof inv !== "string" && "hosted_invoice_url" in inv) {
          invoiceUrl = (inv as { hosted_invoice_url?: string | null }).hosted_invoice_url ?? null;
        }
      }
    } catch {
      // Non-critical — fall back to Supabase status
    }
  }

  return NextResponse.json({
    // Supabase fields
    subscription_status: user.subscription_status,
    trial_start_date: user.trial_start_date,
    trial_end_date: trialEndDate?.toISOString() ?? null,
    trial_days_remaining: trialDaysRemaining,
    member_since: user.created_at,
    emails_processed_count: user.emails_processed_count,
    ai_drafts_count: user.ai_drafts_count,
    // Stripe fields
    stripe_status: stripeStatus,
    plan_interval: planInterval,
    current_period_end: currentPeriodEnd,
    current_period_end_raw: currentPeriodEndRaw,
    cancel_at_period_end: cancelAtPeriodEnd,
    has_stripe_customer: !!user.stripe_customer_id,
    price_amount: priceAmount,
    price_currency: priceCurrency,
    subscription_created: subscriptionCreated,
    invoice_url: invoiceUrl,
  });
}
