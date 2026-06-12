import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listThreads, getThreadMetadata } from "@/lib/gmail";
import type { DiracThread } from "@/lib/types";

/**
 * Process an array of tasks with limited concurrency to avoid API rate limits.
 */
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

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.accessToken || !session.gmailConnected) {
    return NextResponse.json(
      { error: "Not authenticated with Gmail" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const maxResults = Math.min(Number(searchParams.get("maxResults") ?? "25"), 50);
  const q = searchParams.get("q") ?? undefined;
  const pageToken = searchParams.get("pageToken") ?? undefined;

  try {
    const { threads: threadStubs, nextPageToken } = await listThreads(
      session.accessToken,
      maxResults,
      q,
      pageToken,
    );

    // Fetch metadata with max 5 concurrent requests to stay under Gmail rate limits
    const threadMetadata = await batchConcurrent(
      threadStubs,
      (stub) => getThreadMetadata(session.accessToken!, stub.id),
      5,
    );

    const threads: DiracThread[] = threadMetadata.map((t) => ({
      id: t.id,
      platform: "GMAIL" as const,
      subject: t.subject,
      snippet: t.snippet,
      isUnread: t.isUnread,
      isStarred: t.isStarred,
      isUrgent: false,
      messageCount: t.messageCount,
      firstMessageAt: t.firstMessageAt,
      lastMessageAt: t.lastMessageAt,
      participants: t.participants,
      status: "INBOX" as const,
      tags: [],
      isPinned: false,
      gmailCategory: t.gmailCategory,
    }));

    return NextResponse.json({ threads, nextPageToken });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[/api/gmail/threads] fetch error:", detail);
    return NextResponse.json(
      {
        error: "Failed to fetch Gmail threads",
        ...(process.env.NODE_ENV !== "production" && { detail }),
      },
      { status: 500 },
    );
  }
}
