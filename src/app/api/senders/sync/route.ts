import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listThreads, getThreadMetadata } from "@/lib/gmail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 100;       // threads per Gmail API page
const MAX_PAGES = 10;        // up to 1 000 threads per full sync
const CONCURRENCY = 5;       // parallel getThreadMetadata calls

async function batchConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

interface SenderAccumulator {
  email: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  threadCount: number;
}

/**
 * POST /api/senders/sync
 *
 * Paginates through the user's Gmail account (up to MAX_PAGES * PAGE_SIZE
 * threads) to build an accurate sender history cache in Supabase.
 *
 * Supports incremental syncing: if sender_stats rows already exist for this
 * user, only threads newer than the most-recent last_synced_at are fetched.
 * Pass ?full=true to force a complete resync from scratch.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.accessToken || !session.gmailConnected) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No user ID in session" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forceFullSync = searchParams.get("full") === "true";

  const supabase = createSupabaseAdminClient();

  // ── Determine incremental sync window ──────────────────────────────────────
  let afterDate: Date | null = null;

  if (!forceFullSync) {
    const { data: existing } = await supabase
      .from("sender_stats")
      .select("last_synced_at")
      .eq("user_id", userId)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.last_synced_at) {
      // Go back 2 extra days to catch late-arriving threads
      const d = new Date(existing.last_synced_at);
      d.setDate(d.getDate() - 2);
      afterDate = d;
    }
  }

  // Gmail `after:` query uses YYYY/MM/DD format
  const q = afterDate
    ? `after:${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`
    : undefined;

  // ── Paginate through Gmail threads ─────────────────────────────────────────
  const accumulator = new Map<string, SenderAccumulator>();
  let pageToken: string | undefined;
  let pagesLoaded = 0;
  let threadsScanned = 0;

  do {
    const { threads: stubs, nextPageToken } = await listThreads(
      session.accessToken,
      PAGE_SIZE,
      q,
      pageToken,
    );

    if (stubs.length === 0) break;

    // Fetch thread metadata (participants + dates) with limited concurrency
    const metaList = await batchConcurrent(
      stubs,
      (stub) => getThreadMetadata(session.accessToken!, stub.id),
      CONCURRENCY,
    );

    for (const meta of metaList) {
      for (const p of meta.participants) {
        if (!p.email) continue;
        const addr = p.email.toLowerCase();
        const existing = accumulator.get(addr);
        if (existing) {
          if (meta.firstMessageAt < existing.firstSeenAt)
            existing.firstSeenAt = meta.firstMessageAt;
          if (meta.lastMessageAt > existing.lastSeenAt)
            existing.lastSeenAt = meta.lastMessageAt;
          existing.threadCount++;
        } else {
          accumulator.set(addr, {
            email: addr,
            name: p.name || addr,
            firstSeenAt: meta.firstMessageAt,
            lastSeenAt: meta.lastMessageAt,
            threadCount: 1,
          });
        }
      }
    }

    threadsScanned += stubs.length;
    pageToken = nextPageToken;
    pagesLoaded++;
  } while (pageToken && pagesLoaded < MAX_PAGES);

  if (accumulator.size === 0) {
    return NextResponse.json({ synced: 0, totalSenders: 0, threadsScanned });
  }

  // ── Merge with existing Supabase rows and upsert ───────────────────────────
  //
  // We fetch existing rows for the affected emails so we can preserve the
  // historically-earliest firstSeenAt (e.g. if this is an incremental sync,
  // we must not overwrite an older first_seen_at with a newer one).
  const emailsToSync = Array.from(accumulator.keys());

  const { data: existingRows } = await supabase
    .from("sender_stats")
    .select("email, first_seen_at, last_seen_at, thread_count")
    .eq("user_id", userId)
    .in("email", emailsToSync);

  const existingMap = new Map<string, { firstSeenAt: string; lastSeenAt: string; threadCount: number }>();
  for (const row of existingRows ?? []) {
    existingMap.set(row.email, {
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      threadCount: row.thread_count,
    });
  }

  const now = new Date().toISOString();
  const upsertRows = emailsToSync.map((email) => {
    const incoming = accumulator.get(email)!;
    const prev = existingMap.get(email);
    return {
      user_id: userId,
      email,
      name: incoming.name,
      first_seen_at: prev
        ? (prev.firstSeenAt < incoming.firstSeenAt ? prev.firstSeenAt : incoming.firstSeenAt)
        : incoming.firstSeenAt,
      last_seen_at: prev
        ? (prev.lastSeenAt > incoming.lastSeenAt ? prev.lastSeenAt : incoming.lastSeenAt)
        : incoming.lastSeenAt,
      thread_count: prev
        ? Math.max(prev.threadCount, incoming.threadCount)
        : incoming.threadCount,
      last_synced_at: now,
    };
  });

  const { error } = await supabase
    .from("sender_stats")
    .upsert(upsertRows, { onConflict: "user_id,email" });

  if (error) {
    console.error("[/api/senders/sync] upsert error:", error);
    return NextResponse.json({ error: "Failed to save sender stats" }, { status: 500 });
  }

  return NextResponse.json({
    synced: upsertRows.length,
    totalSenders: upsertRows.length,
    threadsScanned,
    incremental: !!afterDate,
  });
}
