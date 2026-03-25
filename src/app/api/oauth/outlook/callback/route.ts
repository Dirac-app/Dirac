import { NextRequest, NextResponse } from "next/server";

const base = () =>
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");

  if (error) {
    console.error("Outlook OAuth error:", error);
    return NextResponse.redirect(`${base()}/settings?outlook_error=auth_failed`);
  }

  return NextResponse.redirect(
    `${base()}/settings?outlook_error=db_required`,
  );
}
