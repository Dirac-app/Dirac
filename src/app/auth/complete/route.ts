import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

/**
 * After NextAuth Google sign-in (Gmail scopes), link a Supabase session via ID token
 * and provision billing. Keeps one Google consent for signup + inbox.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/signup";

  const jwt = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const hasGoogleIdToken = typeof (jwt as { googleIdToken?: unknown })?.googleIdToken === "string";
  console.info("[auth/complete] token summary", {
    hasJwt: !!jwt,
    hasEmail: !!jwt?.email,
    hasGoogleIdToken,
  });

  if (!jwt?.email) {
    return NextResponse.redirect(`${origin}/signup?error=auth&reason=no_nextauth_jwt`);
  }

  const supabase = await createSupabaseServerClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && typeof jwt.googleIdToken === "string") {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: jwt.googleIdToken,
    });

    if (error) {
      console.error("[auth/complete] signInWithIdToken:", error.message);
      const reason = encodeURIComponent(`id_token_exchange_failed:${error.message}`);
      return NextResponse.redirect(`${origin}/signup?error=auth&reason=${reason}`);
    }

    user = data.user;
  }

  if (!user) {
    const hasIdToken = typeof jwt.googleIdToken === "string";
    const reason = hasIdToken ? "supabase_user_missing_after_exchange" : "missing_google_id_token";
    return NextResponse.redirect(`${origin}/signup?error=auth&reason=${reason}`);
  }

  try {
    await ensureUserRowIfNeeded(user);
  } catch (err) {
    console.error("[auth/complete] ensureUserRowIfNeeded:", err);
    return NextResponse.redirect(`${origin}/signup?error=provision`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
