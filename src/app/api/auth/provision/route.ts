import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api-auth";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

/** Retry creating the public.users row after a failed OAuth callback. */
export async function POST() {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  try {
    await ensureUserRowIfNeeded(auth.user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/provision]", err);
    return NextResponse.json(
      { error: "Could not finish account setup.", reason: "provision_failed" },
      { status: 500 },
    );
  }
}
