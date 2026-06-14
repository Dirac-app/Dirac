import type { User } from "@supabase/supabase-js";
import { getUserById, insertMinimalUser } from "@/lib/users-db";

function displayNameFromAuthUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  return name;
}

/**
 * Ensures a public.users row exists for the authenticated user.
 * Does NOT create a Stripe customer — that happens via Stripe Checkout during signup.
 */
export async function ensureUserRowIfNeeded(authUser: User): Promise<void> {
  const existing = await getUserById(authUser.id);
  if (existing) return;

  const email = authUser.email;
  if (!email) {
    throw new Error("Authenticated user is missing an email address");
  }

  await insertMinimalUser({
    id: authUser.id,
    email,
    name: displayNameFromAuthUser(authUser),
  });
}
