import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import {
  updateSubscriptionStatusByStripeCustomer,
  completeTrialSetup,
  getUserByStripeCustomerId,
} from "@/lib/users-db";
import {
  sendUserCancellationGoodbyeEmail,
  formatTrialEndDate,
  subscriptionCancelledDuringTrial,
} from "@/lib/cancellation-email";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

export const runtime = "nodejs";

async function sendCancellationEmail(
  customerId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (subscription.metadata?.dirac_cancel_email_sent === "1") return;

  const appUser = await getUserByStripeCustomerId(customerId);
  if (!appUser?.email) return;

  const duringTrial = subscriptionCancelledDuringTrial(subscription);

  const result = await sendUserCancellationGoodbyeEmail({
    name: appUser.name,
    email: appUser.email,
    duringTrial,
    trialEndDate: formatTrialEndDate(subscription.trial_end),
  });

  if (!result.ok) {
    console.error("[stripe/webhook] cancel email failed:", result.error);
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe/webhook] verify:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Idempotent fallback — verify-payment handles the happy path; this covers
        // users who close the tab before the frontend can call verify-payment.
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const supabaseUserId = session.metadata?.supabase_user_id;
        if (customerId && supabaseUserId) {
          await completeTrialSetup(supabaseUserId, customerId);
          const welcome = await sendWelcomeEmailIfNeeded(supabaseUserId);
          if (!welcome.ok) {
            console.error("[stripe/webhook] welcome email:", welcome.error);
          }
        } else if (customerId) {
          // metadata missing — try to find user by customer ID
          const appUser = await getUserByStripeCustomerId(customerId);
          if (appUser) {
            await completeTrialSetup(appUser.id, customerId);
            const welcome = await sendWelcomeEmailIfNeeded(appUser.id);
            if (!welcome.ok) {
              console.error("[stripe/webhook] welcome email:", welcome.error);
            }
          }
        }
        break;
      }
      case "customer.subscription.created": {
        // Belt-and-suspenders: ensure status is trialing when subscription is created
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (customerId && subscription.status === "trialing") {
          await updateSubscriptionStatusByStripeCustomer(customerId, "trialing");
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await updateSubscriptionStatusByStripeCustomer(customerId, "active");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) break;

        await updateSubscriptionStatusByStripeCustomer(customerId, "expired");

        // Backup goodbye email for cancels outside our app (Stripe dashboard, etc.)
        if (subscription.cancellation_details?.reason === "payment_failed") break;
        void sendCancellationEmail(customerId, subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] handler:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
