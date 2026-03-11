import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOutlookAccount, disconnectAccount } from "@/lib/user-db";
import { getOutlookAccessToken } from "@/lib/outlook-token";

export async function GET() {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ connected: false });

  const account = await getOutlookAccount(session.userId);
  if (!account) return NextResponse.json({ connected: false });

  // Attempt token refresh if needed (also validates the token is usable)
  const token = await getOutlookAccessToken(session.userId);
  if (!token) return NextResponse.json({ connected: false, error: "token_expired" });

  return NextResponse.json({
    connected: true,
    email: account.platformAccountId,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await disconnectAccount({ userId: session.userId, platform: "OUTLOOK" });
  return NextResponse.json({ ok: true });
}
