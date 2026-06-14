import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inbox";

  const authError = searchParams.get("error");
  const authErrorDescription = searchParams.get("error_description");
  if (authError) {
    console.error(
      "[auth/callback] Supabase auth error:",
      authError,
      authErrorDescription ?? "",
    );
    return NextResponse.redirect(`${origin}/signup?error=auth`);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession:", error.message);
      return NextResponse.redirect(`${origin}/signup?error=auth`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        await ensureUserRowIfNeeded(user);
      } catch (err) {
        console.error("[auth/callback] ensureUserRowIfNeeded:", err);
        return NextResponse.redirect(`${origin}/signup?error=provision`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
