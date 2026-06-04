/**
 * Supabase API keys (2026+):
 * - Publishable: `sb_publishable_...` (preferred) — same role as legacy `anon` JWT
 * - Secret: `sb_secret_...` (preferred) — same role as legacy `service_role` JWT
 *
 * @see https://supabase.com/docs/guides/api/api-keys
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return url;
}

/** Client-safe key for browser + session refresh (publishable or legacy anon). */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key?.trim()) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) or " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy JWT anon key)",
    );
  }
  return key.trim();
}

/** Server-only elevated key (secret or legacy service_role). */
export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key?.trim()) {
    throw new Error(
      "Set SUPABASE_SECRET_KEY (sb_secret_...) or SUPABASE_SERVICE_ROLE_KEY (legacy JWT)",
    );
  }
  return key.trim();
}
