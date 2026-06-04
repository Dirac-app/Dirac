import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabaseUser } from "@/lib/api-auth";
import {
  updateOnboardingAnswers,
  type EmailVolume,
  type MainPainPoint,
  type UserRole,
} from "@/lib/users-db";
import { ensureUserRowIfNeeded } from "@/lib/provision-user";

const BodySchema = z.object({
  user_role: z.enum([
    "founder_ceo",
    "operator",
    "sales",
    "product_engineering",
    "investor",
    "other",
  ]),
  email_volume: z.enum(["receipts", "cold_outreach", "internal_investor", "other"]),
  main_pain_point: z.enum(["volume", "replies", "missing_important", "other"]),
});

export async function PATCH(request: Request) {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;
  await ensureUserRowIfNeeded(auth.user);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await updateOnboardingAnswers(auth.user.id, {
    user_role: body.user_role as UserRole,
    email_volume: body.email_volume as EmailVolume,
    main_pain_point: body.main_pain_point as MainPainPoint,
  });

  return NextResponse.json({ ok: true });
}
