import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { markOnboardingComplete } from "@/lib/users-db";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

export async function POST() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  await ensureUserRowIfNeeded(auth.user);
  await markOnboardingComplete(auth.user.id);
  return NextResponse.json({ ok: true });
}
