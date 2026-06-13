import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { markOnboardingComplete, getUserById } from "@/lib/users-db";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";
import { buildWelcomeEmail, sendEmail } from "@/lib/email-utils";

export async function POST() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  await ensureUserRowIfNeeded(auth.user);
  await markOnboardingComplete(auth.user.id);

  // Fire welcome email in the background — don't block the redirect
  void sendWelcomeEmail(auth.user.id, auth.user.email ?? "");

  return NextResponse.json({ ok: true });
}

async function sendWelcomeEmail(userId: string, fallbackEmail: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const appUrl = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "https://app.dirac.app").replace(/\/$/, "");

    const user = await getUserById(userId);
    const to = user?.email ?? fallbackEmail;
    if (!to) return;

    const { subject, html, text } = buildWelcomeEmail({
      name: user?.name ?? null,
      email: to,
      inboxUrl: `${appUrl}/inbox`,
    });

    const result = await sendEmail({
      apiKey,
      from: "Peter @ Dirac <peter@dirac.app>",
      to,
      subject,
      html,
      text,
    });

    if (!result.ok) {
      console.error("[welcome-email] send failed:", result.error);
    }
  } catch (err) {
    // Never crash the onboarding completion if email fails
    console.error("[welcome-email] unexpected error:", err);
  }
}
