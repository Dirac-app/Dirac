import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { createClient } from "@supabase/supabase-js";

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * DELETE /api/emails/schedule/[id]
 * Cancels a pending scheduled email.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const { id } = await params;
  const db = getDb();

  // Verify ownership before cancelling
  const { data: existing, error: findError } = await db
    .from("scheduled_emails")
    .select("id")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .eq("status", "PENDING")
    .single();

  if (findError || !existing) {
    return NextResponse.json(
      { error: "Scheduled email not found or already sent" },
      { status: 404 },
    );
  }

  const { error } = await db
    .from("scheduled_emails")
    .update({ status: "CANCELLED" })
    .eq("id", id);

  if (error) {
    console.error("Cancel scheduled email error:", error);
    return NextResponse.json({ error: "Failed to cancel scheduled email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
