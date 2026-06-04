import { NextRequest, NextResponse } from "next/server";
import { linkSupabaseAccount } from "@/lib/link-supabase-account";

/**
 * Legacy redirect target after Google OAuth. Prefer POST /api/auth/link-supabase from /signup.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/signup";

  const result = await linkSupabaseAccount(request);
  if (!result.ok) {
    const reason = encodeURIComponent(result.reason);
    return NextResponse.redirect(`${origin}/signup?error=auth&reason=${reason}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
