import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { ensureUserRowIfNeeded, runOnboardingSetup } from "@/lib/provision-user";

export async function POST() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  try {
    await ensureUserRowIfNeeded(auth.user);
    await runOnboardingSetup(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/setup]", err);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
