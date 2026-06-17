import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { markOnboardingComplete } from "@/lib/users-db";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

export async function POST() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  await ensureUserRowIfNeeded(auth.user);
  await markOnboardingComplete(auth.user.id);

  // Backup if checkout path didn't send (e.g. older signups)
  const emailResult = await sendWelcomeEmailIfNeeded(auth.user.id);
  if (!emailResult.ok) {
    console.error("[onboarding/complete] welcome email:", emailResult.error);
  }

  return NextResponse.json({ ok: true, welcomeEmailSent: emailResult.ok && emailResult.sent });
}
