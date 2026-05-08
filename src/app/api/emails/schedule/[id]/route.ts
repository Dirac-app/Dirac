import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/user-db";

/**
 * DELETE /api/emails/schedule/[id]
 * Cancels a scheduled email.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const { id } = await params;

  try {
    // Check if the scheduled email exists and belongs to the user
    const scheduledEmail = await prisma.scheduledEmail.findFirst({
      where: {
        id,
        userId: guard.userId!,
        status: "PENDING",
      },
    });

    if (!scheduledEmail) {
      return NextResponse.json(
        { error: "Scheduled email not found or already sent" },
        { status: 404 }
      );
    }

    // Cancel the scheduled email
    await prisma.scheduledEmail.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cancel scheduled email error:", err);
    return NextResponse.json(
      { error: "Failed to cancel scheduled email" },
      { status: 500 }
    );
  }
}
