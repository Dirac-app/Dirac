import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateBody, DiscordSendSchema } from "@/lib/validation";
import { sendChannelMessage } from "@/lib/discord";

const COOKIE_NAME = "dirac_discord";

/**
 * POST /api/discord/send
 * Sends a message to a Discord channel via the bot.
 * Body: { channelId, content }
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json({ error: "Not connected to Discord" }, { status: 401 });
  }

  const parsed = await validateBody(request, DiscordSendSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { channelId, content } = parsed.data;

  try {
    await sendChannelMessage(channelId, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Discord send error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
