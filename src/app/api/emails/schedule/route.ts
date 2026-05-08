import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { validateBody, ScheduleEmailSchema } from "@/lib/validation";
import { prisma } from "@/lib/user-db";

/**
 * POST /api/emails/schedule
 * Schedules an email for future delivery.
 * Body: { to, cc?, bcc?, subject?, body, threadId?, messageId?, scheduledFor, platform }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const parsed = await validateBody(request, ScheduleEmailSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { to, cc, bcc, subject, body, threadId, messageId, scheduledFor, platform } = parsed.data;

  // Validate scheduledFor is in the future
  const scheduledDate = new Date(scheduledFor);
  const now = new Date();
  if (scheduledDate <= now) {
    return NextResponse.json(
      { error: "Scheduled time must be in the future" },
      { status: 400 }
    );
  }

  try {
    const scheduledEmail = await prisma.scheduledEmail.create({
      data: {
        userId: guard.userId!,
        platform,
        to,
        cc: cc || null,
        bcc: bcc || null,
        subject: subject || null,
        body,
        threadId: threadId || null,
        messageId: messageId || null,
        scheduledFor: scheduledDate,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      scheduledEmailId: scheduledEmail.id,
      scheduledFor: scheduledEmail.scheduledFor,
    });
  } catch (err) {
    console.error("Schedule email error:", err);
    return NextResponse.json(
      { error: "Failed to schedule email" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/schedule
 * Lists all scheduled emails for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  try {
    const scheduledEmails = await prisma.scheduledEmail.findMany({
      where: {
        userId: guard.userId!,
        status: "PENDING",
      },
      orderBy: {
        scheduledFor: "asc",
      },
      select: {
        id: true,
        to: true,
        cc: true,
        subject: true,
        body: true,
        scheduledFor: true,
        platform: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ scheduledEmails });
  } catch (err) {
    console.error("List scheduled emails error:", err);
    return NextResponse.json(
      { error: "Failed to list scheduled emails" },
      { status: 500 }
    );
  }
}
