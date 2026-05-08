import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type ExportFormat = "pdf" | "json" | "mbox";

/**
 * GET /api/threads/export?platform=gmail&threadId=xxx&format=pdf
 *
 * Returns the full thread data (thread + messages) needed for client-side
 * export. The actual file generation (PDF / MBOX / JSON) happens in the
 * browser so no streaming logic is needed here.
 *
 * The API validates:
 *   1. The user is authenticated.
 *   2. A valid platform (gmail | outlook | discord) is provided.
 *   3. A threadId is provided.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const threadId = searchParams.get("threadId");

  if (!platform || !threadId) {
    return NextResponse.json(
      { error: "Missing platform or threadId query parameter" },
      { status: 400 },
    );
  }

  if (!["gmail", "outlook", "discord"].includes(platform.toLowerCase())) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  // Forward to the appropriate platform-specific thread endpoint
  // so we reuse existing auth & data-fetching logic.
  const upstreamPath =
    platform === "outlook"
      ? `/api/outlook/threads/${threadId}`
      : platform === "discord"
        ? `/api/discord/threads/${threadId}`
        : `/api/gmail/threads/${threadId}`;

  try {
    const upstream = await fetch(
      new URL(upstreamPath, req.nextUrl.origin),
      {
        headers: {
          cookie: req.headers.get("cookie") ?? "",
        },
        cache: "no-store",
      },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to fetch thread" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();

    return NextResponse.json(
      {
        thread: data.thread ?? data,
        messages: data.messages ?? [],
        platform: platform.toUpperCase(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("[threads/export] upstream error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
