import { NextRequest, NextResponse } from "next/server";
import { linkSupabaseAccount } from "@/lib/link-supabase-account";

export async function POST(request: NextRequest) {
  const result = await linkSupabaseAccount(request);
  if (!result.ok) {
    const status = result.reason === "provision_failed" ? 500 : 401;
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status },
    );
  }
  return NextResponse.json({ ok: true, supabaseUserId: result.supabaseUserId });
}
