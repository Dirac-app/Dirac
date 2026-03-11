import { NextResponse } from "next/server";
import { getDiscordAuthUrl } from "@/lib/discord";

/**
 * GET /api/oauth/discord
 * Redirects the user to Discord OAuth2 authorization.
 */
export async function GET() {
  const url = getDiscordAuthUrl();
  return NextResponse.redirect(url);
}
