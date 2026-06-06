import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabaseUser } from "@/lib/api-auth";
import { insertTrialFeedback } from "@/lib/trial-feedback-db";

const BodySchema = z.object({
  decision: z.enum(["continuing", "not_continuing", "undecided"]),
  message: z.string().trim().min(3).max(2000),
  reminder_key: z.string().max(32).optional(),
  source: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await insertTrialFeedback({
      userId: auth.user.id,
      decision: body.decision,
      message: body.message,
      reminderKey: body.reminder_key,
      source: body.source,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[trial-feedback]", err);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
