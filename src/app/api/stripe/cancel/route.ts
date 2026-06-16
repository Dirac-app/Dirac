import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { getUserById, updateSubscriptionStatus } from "@/lib/users-db";
import { getStripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email-utils";
import { insertCancellationFeedback } from "@/lib/cancellation-feedback-db";
import {
  formatTrialEndDate,
  sendUserCancellationGoodbyeEmail,
} from "@/lib/cancellation-email";

interface CancelBody {
  reason?: string;
  improvement?: string;
  comeback?: string;
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  const user = await getUserById(auth.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  let body: CancelBody = {};
  try {
    body = (await request.json()) as CancelBody;
  } catch {
    // feedback is optional
  }

  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: "all",
    limit: 5,
  });

  const active = subscriptions.data.find(
    (s) => s.status === "active" || s.status === "trialing",
  );

  if (!active) {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  const isTrialing = active.status === "trialing";
  let cancelAt: string | null = null;
  let cancelAtIso: string | null = null;

  // Mark so webhook won't send a duplicate goodbye email
  const metadata = {
    ...active.metadata,
    dirac_cancel_email_sent: "1",
  };

  if (isTrialing) {
    await stripe.subscriptions.update(active.id, { metadata });
    const cancelled = await stripe.subscriptions.cancel(active.id);
    cancelAtIso = new Date().toISOString();
    // Trial cancel is immediate — revoke app access now
    await updateSubscriptionStatus(user.id, "expired");
    active.trial_end = cancelled.trial_end;
  } else {
    const updated = await stripe.subscriptions.update(active.id, {
      cancel_at_period_end: true,
      metadata,
    });
    if (updated.current_period_end) {
      cancelAtIso = new Date(updated.current_period_end * 1000).toISOString();
      cancelAt = new Date(updated.current_period_end * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    // Paid users keep access until period end; webhook sets expired when Stripe deletes sub
  }

  try {
    await insertCancellationFeedback({
      userId: user.id,
      reason: body.reason,
      improvement: body.improvement,
      comeback: body.comeback,
      planStatus: active.status,
      cancelType: isTrialing ? "immediate" : "at_period_end",
      cancelAt: cancelAtIso,
      stripeSubscriptionId: active.id,
    });
  } catch (err) {
    console.error("[cancellation-feedback]", err);
  }

  // Goodbye email to the user (not just Peter)
  const goodbye = await sendUserCancellationGoodbyeEmail({
    name: user.name,
    email: user.email,
    duringTrial: isTrialing,
    trialEndDate: formatTrialEndDate(active.trial_end),
  });
  if (!goodbye.ok) {
    console.error("[stripe/cancel] goodbye email failed:", goodbye.error);
  }

  // Offboarding feedback notification to Peter
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && (body.reason || body.improvement || body.comeback)) {
    const firstName = user.name?.trim().split(/\s+/)[0] ?? user.email;
    const lines = [
      `User: ${user.name ?? "(no name)"} <${user.email}>`,
      `Plan status: ${active.status}`,
      body.reason ? `\nWhy leaving: ${body.reason}` : "",
      body.improvement ? `\n#1 improvement: ${body.improvement}` : "",
      body.comeback ? `\nWhat would bring back: ${body.comeback}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await sendEmail({
      apiKey: resendKey,
      from: "Dirac <notifications@dirac.app>",
      to: "peter@dirac.app",
      subject: `Cancellation: ${firstName} (${active.status})`,
      html: `<pre style="font-family:monospace;font-size:13px;line-height:1.6;">${lines}</pre>`,
      text: lines,
    }).catch(() => {/* non-critical */});
  }

  return NextResponse.json({
    ok: true,
    cancelAt,
    wasTrialing: isTrialing,
    goodbyeEmailSent: goodbye.ok,
  });
}
