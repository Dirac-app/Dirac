import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";
import { completeTrialSetup } from "@/lib/users-db";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

/**
 * Called by the signup flow after Stripe redirects to /signup?payment=success&session_id=xxx.
 * Verifies the checkout session and stores the Stripe customer ID + trial start date.
 */
export async function GET(request: Request) {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = getStripe();
  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[verify-payment] retrieve:", err);
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // Verify this session belongs to the authenticated user
  const metaUserId = checkoutSession.metadata?.supabase_user_id;
  if (metaUserId && metaUserId !== auth.user.id) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }

  // For subscriptions with a trial, payment_status is "no_payment_required" — check status instead
  if (checkoutSession.status !== "complete") {
    return NextResponse.json(
      { error: "Checkout not complete", checkoutStatus: checkoutSession.status },
      { status: 402 },
    );
  }

  const customerId =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer?.id;

  if (!customerId) {
    return NextResponse.json({ error: "No customer on session" }, { status: 400 });
  }

  await completeTrialSetup(auth.user.id, customerId);

  const welcome = await sendWelcomeEmailIfNeeded(auth.user.id);
  if (!welcome.ok) {
    console.error("[verify-payment] welcome email:", welcome.error);
  }

  return NextResponse.json({ ok: true, welcomeEmailSent: welcome.ok && welcome.sent });
}
