import { NextResponse } from "next/server";
import { getDiscordBotInviteUrl } from "@/lib/discord";

/**
 * GET /api/discord/bot-invite
 * Redirects to Discord bot invite URL.
 */
export async function GET() {
  const url = getDiscordBotInviteUrl();
  return NextResponse.redirect(url);
}
