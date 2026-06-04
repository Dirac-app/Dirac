import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { getUserById } from "@/lib/users-db";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

export async function GET() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  await ensureUserRowIfNeeded(auth.user);
  const profile = await getUserById(auth.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    email_volume: profile.email_volume,
    main_pain_point: profile.main_pain_point,
    shown_tooltips: profile.shown_tooltips,
    onboarding_completed_at: profile.onboarding_completed_at,
    subscription_status: profile.subscription_status,
  });
}
