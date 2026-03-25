import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { getDefaultModel } from "@/lib/user-db";

/**
 * Settings are stored client-side in localStorage for the MVP.
 * This endpoint returns server defaults so the client has a fallback.
 */
export async function GET() {
  const guard = await requireSession();
  if (guard.error) return guard.response;

  return NextResponse.json({
    aiModel: getDefaultModel(),
    aboutMe: "",
  });
}

export async function PATCH() {
  const guard = await requireSession();
  if (guard.error) return guard.response;

  return NextResponse.json({ ok: true, persisted: false });
}
