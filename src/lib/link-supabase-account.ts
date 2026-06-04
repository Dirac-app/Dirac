import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";
import { getAuthSecret } from "@/lib/auth-secret";

export type LinkSupabaseResult =
  | { ok: true }
  | { ok: false; reason: string; message: string };

/**
 * Links Supabase Auth to the current NextAuth Google session (server-side).
 */
export async function linkSupabaseAccount(request: NextRequest): Promise<LinkSupabaseResult> {
  const secret = getAuthSecret();
  if (!secret) {
    return {
      ok: false,
      reason: "missing_auth_secret",
      message: "Server auth secret is not configured (set AUTH_SECRET or NEXTAUTH_SECRET on Vercel).",
    };
  }

  const jwt = await getToken({
    req: request,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!jwt?.email) {
    return {
      ok: false,
      reason: "no_nextauth_jwt",
      message: "Google session was not found. Complete sign-in again from the signup button.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  if (existingUser) {
    try {
      await ensureUserRowIfNeeded(existingUser);
      return { ok: true };
    } catch (err) {
      console.error("[link-supabase] ensureUserRowIfNeeded:", err);
      return { ok: false, reason: "provision_failed", message: "Could not finish account setup." };
    }
  }

  const googleIdToken = jwt.googleIdToken;
  if (typeof googleIdToken !== "string") {
    return {
      ok: false,
      reason: "missing_google_id_token",
      message: "Google did not return an ID token. Try signing in again with consent.",
    };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: googleIdToken,
  });

  if (error) {
    console.error("[link-supabase] signInWithIdToken:", error.message);
    return {
      ok: false,
      reason: "id_token_exchange_failed",
      message: error.message,
    };
  }

  if (!data.user) {
    return { ok: false, reason: "supabase_user_missing", message: "Supabase user was not created." };
  }

  try {
    await ensureUserRowIfNeeded(data.user);
    return { ok: true };
  } catch (err) {
    console.error("[link-supabase] ensureUserRowIfNeeded:", err);
    return { ok: false, reason: "provision_failed", message: "Could not finish account setup." };
  }
}
