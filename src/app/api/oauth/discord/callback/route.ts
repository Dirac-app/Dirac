import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeDiscordCode, getDiscordUser } from "@/lib/discord";

const COOKIE_NAME = "dirac_discord";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * GET /api/oauth/discord/callback
 * Handles the OAuth2 callback from Discord.
 * Stores user info + tokens in an HTTP-only cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("Discord OAuth error:", error);
    const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${base}/settings?discord_error=auth_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenData = await exchangeDiscordCode(code);

    // Get the user's Discord profile
    const user = await getDiscordUser(tokenData.access_token);

    // Build the cookie payload
    const payload = {
      userId: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${base}/settings?discord=connected`);
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${base}/settings?discord_error=token_exchange`);
  }
}
