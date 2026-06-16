import { NextRequest, NextResponse } from "next/server";
import { exchangeOutlookCode } from "@/lib/outlook";

const base = () =>
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

function parseReturnTo(state: string | null): string {
  if (!state) return "/settings";
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      returnTo?: string;
    };
    if (parsed.returnTo?.startsWith("/")) return parsed.returnTo;
  } catch {
    /* ignore */
  }
  return "/settings";
}

function appendQuery(path: string, key: string, value: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${key}=${encodeURIComponent(value)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const returnTo = parseReturnTo(searchParams.get("state"));

  if (error) {
    console.error("Outlook OAuth error:", error);
    return NextResponse.redirect(`${base()}${appendQuery(returnTo, "outlook", "error")}`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${base()}${appendQuery(returnTo, "outlook", "error")}`);
  }

  try {
    await exchangeOutlookCode(code);
    return NextResponse.redirect(`${base()}${appendQuery(returnTo, "outlook", "connected")}`);
  } catch (err) {
    console.error("[outlook/callback]", err);
    return NextResponse.redirect(`${base()}${appendQuery(returnTo, "outlook", "error")}`);
  }
}
