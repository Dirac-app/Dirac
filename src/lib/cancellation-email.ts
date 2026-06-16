import {
  buildCancelAfterTrialEmail,
  buildCancelDuringTrialEmail,
  sendEmail,
} from "@/lib/email-utils";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.dirac.app"
  ).replace(/\/$/, "");
}

export function formatTrialEndDate(trialEndUnix: number | null | undefined): string {
  const trialEndMs = (trialEndUnix ?? 0) * 1000;
  if (trialEndMs <= 0) return "the end of your trial";
  return new Date(trialEndMs).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Goodbye email to the user when they cancel (or subscription ends). */
export async function sendUserCancellationGoodbyeEmail(input: {
  name: string | null;
  email: string;
  duringTrial: boolean;
  trialEndDate?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[cancellation-email] RESEND_API_KEY missing");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const reactivateUrl = `${getAppUrl()}/upgrade`;

  const { subject, html, text } = input.duringTrial
    ? buildCancelDuringTrialEmail({
        name: input.name,
        email: input.email,
        trialEndDate: input.trialEndDate ?? "the end of your trial",
        reactivateUrl,
      })
    : buildCancelAfterTrialEmail({
        name: input.name,
        email: input.email,
        reactivateUrl,
      });

  return sendEmail({
    apiKey,
    from: "Peter @ Dirac <peter@dirac.app>",
    to: input.email,
    subject,
    html,
    text,
  });
}

/** Detect trial vs paid cancel from a Stripe subscription object. */
export function subscriptionCancelledDuringTrial(sub: {
  status: string;
  trial_end?: number | null;
  canceled_at?: number | null;
}): boolean {
  if (sub.status === "trialing") return true;
  if (sub.trial_end && sub.canceled_at) {
    return sub.canceled_at <= sub.trial_end;
  }
  return false;
}
