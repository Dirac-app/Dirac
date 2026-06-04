import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { validateBody, ScheduleEmailSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getDb() {
  return createSupabaseAdminClient();
}

/**
 * POST /api/emails/schedule
 * Schedules an email for future delivery.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const parsed = await validateBody(request, ScheduleEmailSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { to, cc, bcc, subject, body, threadId, messageId, scheduledFor, platform } = parsed.data;

  const scheduledDate = new Date(scheduledFor);
  if (scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: "Scheduled time must be in the future" },
      { status: 400 },
    );
  }

  const { data, error } = await getDb()
    .from("scheduled_emails")
    .insert({
      user_id: guard.userId,
      platform,
      to_address: to,
      cc_address: cc ?? null,
      bcc_address: bcc ?? null,
      subject: subject ?? null,
      body,
      thread_id: threadId ?? null,
      message_id: messageId ?? null,
      scheduled_for: scheduledDate.toISOString(),
      status: "PENDING",
    })
    .select("id, scheduled_for")
    .single();

  if (error) {
    console.error("Schedule email error:", error);
    return NextResponse.json({ error: "Failed to schedule email" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scheduledEmailId: data.id,
    scheduledFor: data.scheduled_for,
  });
}

/**
 * GET /api/emails/schedule
 * Lists all pending scheduled emails for the authenticated user.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const { data, error } = await getDb()
    .from("scheduled_emails")
    .select("id, to_address, cc_address, subject, body, scheduled_for, platform, created_at")
    .eq("user_id", guard.userId)
    .eq("status", "PENDING")
    .order("scheduled_for", { ascending: true });

  if (error) {
    console.error("List scheduled emails error:", error);
    return NextResponse.json({ error: "Failed to list scheduled emails" }, { status: 500 });
  }

  return NextResponse.json({ scheduledEmails: data ?? [] });
}
