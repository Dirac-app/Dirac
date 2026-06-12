import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SenderStatRow {
  email: string;
  name: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  threadCount: number;
  lastSyncedAt: string;
}

/**
 * GET /api/senders/stats
 *
 * Returns the cached sender history for the current user from Supabase.
 * Also returns `lastSyncedAt` so the client knows when the cache was built.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("sender_stats")
    .select("email, name, first_seen_at, last_seen_at, thread_count, last_synced_at")
    .eq("user_id", session.user.id)
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("[/api/senders/stats] query error:", error);
    return NextResponse.json({ error: "Failed to load sender stats" }, { status: 500 });
  }

  const stats: SenderStatRow[] = (data ?? []).map((row) => ({
    email: row.email,
    name: row.name,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    threadCount: row.thread_count,
    lastSyncedAt: row.last_synced_at,
  }));

  // Surface the latest sync timestamp across all rows
  const lastSyncedAt = stats.length > 0
    ? stats.reduce((max, r) => (r.lastSyncedAt > max ? r.lastSyncedAt : max), stats[0].lastSyncedAt)
    : null;

  return NextResponse.json({ stats, lastSyncedAt });
}
