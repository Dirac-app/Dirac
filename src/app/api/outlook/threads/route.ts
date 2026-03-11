import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listOutlookThreads, mapOutlookThreadToDirac } from "@/lib/outlook";
import { getOutlookAccessToken } from "@/lib/outlook-token";

export async function GET() {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ threads: [] });

  const accessToken = await getOutlookAccessToken(session.userId);
  if (!accessToken) return NextResponse.json({ threads: [] });

  try {
    const outlookThreads = await listOutlookThreads(accessToken);
    return NextResponse.json({ threads: outlookThreads.map(mapOutlookThreadToDirac) });
  } catch (err) {
    console.error("Outlook threads error:", err);
    return NextResponse.json({ threads: [], error: "Failed to fetch Outlook threads" });
  }
}
