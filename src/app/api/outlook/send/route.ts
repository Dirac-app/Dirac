import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { validateBody, OutlookSendSchema } from "@/lib/validation";
import { sendOutlookReply, sendOutlookMail } from "@/lib/outlook";
import { getOutlookAccessToken } from "@/lib/outlook-token";

export async function POST(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const accessToken = await getOutlookAccessToken(guard.userId!);
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Outlook" }, { status: 401 });
  }

  const parsed = await validateBody(request, OutlookSendSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { messageId, to, subject, body } = parsed.data;

  try {
    if (messageId) {
      await sendOutlookReply(accessToken, messageId, body);
    } else if (to) {
      await sendOutlookMail(accessToken, to, subject ?? "", body);
    } else {
      return NextResponse.json({ error: "messageId or to is required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Outlook send error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
