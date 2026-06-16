import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/outlook";

/**
 * GET /api/oauth/outlook?returnTo=/signup?after=outlook
 * Redirects the user to Microsoft OAuth2 authorization.
 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/settings";
  const state = Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");
  const url = getOutlookAuthUrl(state);
  return NextResponse.redirect(url);
}
