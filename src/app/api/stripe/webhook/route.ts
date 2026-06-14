import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import {
  updateSubscriptionStatusByStripeCustomer,
  completeTrialSetup,
  getUserByStripeCustomerId,
} from "@/lib/users-db";
import {
  buildCancelDuringTrialEmail,
  buildCancelAfterTrialEmail,
  sendEmail,
} from "@/lib/email-utils";

export const runtime = "nodejs";

async function sendCancellationEmail(
  customerId: string,
  duringTrial: boolean,
  subscription: Stripe.Subscription,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const appUser = await getUserByStripeCustomerId(customerId);
  if (!appUser?.email) return;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.dirac.app"
  ).replace(/\/$/, "");

  const reactivateUrl = `${appUrl}/settings`;

  let subject: string;
  let html: string;
  let text: string;

  if (duringTrial) {
    // Show trial end date so they know when access stops
    const trialEndMs = (subscription.trial_end ?? 0) * 1000;
    const trialEndDate =
      trialEndMs > 0
        ? new Date(trialEndMs).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "the end of your trial";

    ({ subject, html, text } = buildCancelDuringTrialEmail({
      name: appUser.name,
      email: appUser.email,
      trialEndDate,
      reactivateUrl,
    }));
  } else {
    ({ subject, html, text } = buildCancelAfterTrialEmail({
      name: appUser.name,
      email: appUser.email,
      reactivateUrl,
    }));
  }

  const result = await sendEmail({
    apiKey,
    from: "Peter @ Dirac <peter@dirac.app>",
    to: appUser.email,
    subject,
    html,
    text,
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
        } else if (customerId) {
          // metadata missing — try to find user by customer ID
          const appUser = await getUserByStripeCustomerId(customerId);
          if (appUser) await completeTrialSetup(appUser.id, customerId);
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

        // Send cancellation email only for intentional cancels (not payment failures)
        const cancelledDuringTrial = subscription.status === "trialing";
        const cancelledAfterTrial = subscription.status === "active";
        if (cancelledDuringTrial || cancelledAfterTrial) {
          void sendCancellationEmail(customerId, cancelledDuringTrial, subscription);
        }
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
