import { NextResponse } from "next/server";
import { getUserByEmail, getUsersNeedingWelcomeEmail } from "@/lib/users-db";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

function authorize(request: Request): boolean {
  const secret =
    process.env.WELCOME_EMAIL_BACKFILL_SECRET ??
    process.env.TRIAL_REMINDER_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Backfill welcome emails for users who paid but never received one.
 * POST /api/admin/send-welcome-emails
 * Authorization: Bearer $WELCOME_EMAIL_BACKFILL_SECRET (or TRIAL_REMINDER_CRON_SECRET)
 * Body (optional): { "email": "user@example.com", "force": true }
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let email: string | undefined;
  let force = false;
  try {
    const body = (await request.json()) as { email?: string; force?: boolean };
    email = body.email?.trim();
    force = body.force === true;
  } catch {
    /* empty body = backfill all */
  }

  const users = email
    ? await (async () => {
        const user = await getUserByEmail(email);
        return user ? [user] : [];
      })()
    : await getUsersNeedingWelcomeEmail();

  if (email && users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const results: { email: string; sent: boolean; error?: string }[] = [];

  for (const user of users) {
    const result = await sendWelcomeEmailIfNeeded(user.id, { force });
    results.push({
      email: user.email,
      sent: result.ok && result.sent,
      error: result.ok ? undefined : result.error,
    });
  }

  return NextResponse.json({
    ok: true,
    count: results.length,
    sent: results.filter((r) => r.sent).length,
    results,
  });
}
