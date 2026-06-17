import { buildWelcomeEmail, sendEmail } from "@/lib/email-utils";
import { getUserById, markWelcomeEmailSent } from "@/lib/users-db";

export type WelcomeEmailResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: string };

/** Send the trial welcome email once per user (after checkout). */
export async function sendWelcomeEmailIfNeeded(
  userId: string,
  options?: { force?: boolean },
): Promise<WelcomeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[welcome-email] RESEND_API_KEY missing on web server");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const user = await getUserById(userId);
  if (!user?.email) {
    return { ok: false, error: "User email not found" };
  }
  if (!options?.force && user.welcome_email_sent_at) {
    return { ok: true, sent: false };
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.dirac.app"
  ).replace(/\/$/, "");

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Peter @ Dirac <peter@dirac.app>";

  const { subject, html, text } = buildWelcomeEmail({
    name: user.name,
    email: user.email,
    inboxUrl: `${appUrl}/inbox`,
  });

  const result = await sendEmail({
    apiKey,
    from,
    to: user.email,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    console.error("[welcome-email] send failed:", result.error);
    return { ok: false, error: result.error ?? "Send failed" };
  }

  await markWelcomeEmailSent(userId);
  return { ok: true, sent: true };
}
