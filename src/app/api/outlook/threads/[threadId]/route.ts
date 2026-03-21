import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getOutlookThreadMessages,
  mapOutlookMessageToDirac,
  markOutlookMessageRead,
  markOutlookMessageUnread,
  archiveOutlookMessage,
  trashOutlookMessage,
} from "@/lib/outlook";
import { getOutlookAccessToken } from "@/lib/outlook-token";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getOutlookAccessToken(session.userId);
  if (!accessToken) return NextResponse.json({ error: "Not connected to Outlook" }, { status: 401 });

  const conversationId = threadId.replace(/^outlook-/, "");

  try {
    const graphMessages = await getOutlookThreadMessages(accessToken, conversationId);
    const messages = graphMessages.map(mapOutlookMessageToDirac);

    const unreadIds = graphMessages.filter(m => !m.isRead).map(m => m.id);
    if (unreadIds.length > 0) {
      // Await so state is consistent before responding; non-fatal on failure.
      await Promise.allSettled(unreadIds.map(id => markOutlookMessageRead(accessToken, id)));
    }

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Outlook messages error:", err);
    return NextResponse.json({ error: "Failed to fetch Outlook messages" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getOutlookAccessToken(session.userId);
  if (!accessToken) return NextResponse.json({ error: "Not connected to Outlook" }, { status: 401 });

  const conversationId = threadId.replace(/^outlook-/, "");
  const body = await request.json();
  const VALID_ACTIONS = ["mark-read", "mark-unread", "archive", "trash"] as const;
  type Action = typeof VALID_ACTIONS[number];
  const action = body?.action as string | undefined;
  if (!action || !(VALID_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
  const validatedAction = action as Action;

  try {
    const graphMessages = await getOutlookThreadMessages(accessToken, conversationId);
    const messageIds = graphMessages.map(m => m.id);

    switch (validatedAction) {
      case "mark-read":   await Promise.allSettled(messageIds.map(id => markOutlookMessageRead(accessToken, id)));   break;
      case "mark-unread": await Promise.allSettled(messageIds.map(id => markOutlookMessageUnread(accessToken, id))); break;
      case "archive":     await Promise.allSettled(messageIds.map(id => archiveOutlookMessage(accessToken, id)));    break;
      case "trash":       await Promise.allSettled(messageIds.map(id => trashOutlookMessage(accessToken, id)));      break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Outlook thread modify error (${validatedAction}):`, err);
    return NextResponse.json({ error: `Failed to ${validatedAction} thread` }, { status: 500 });
  }
}
