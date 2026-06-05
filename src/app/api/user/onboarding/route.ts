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

const otherText = z.string().trim().min(1).max(200);

const BodySchema = z
  .object({
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
    user_role_other: z.string().trim().max(200).optional(),
    email_volume_other: z.string().trim().max(200).optional(),
    main_pain_point_other: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.user_role === "other" && !otherText.safeParse(data.user_role_other).success) {
      ctx.addIssue({ code: "custom", path: ["user_role_other"], message: "Required when role is Other" });
    }
    if (data.email_volume === "other" && !otherText.safeParse(data.email_volume_other).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email_volume_other"],
        message: "Required when inbox type is Other",
      });
    }
    if (data.main_pain_point === "other" && !otherText.safeParse(data.main_pain_point_other).success) {
      ctx.addIssue({
        code: "custom",
        path: ["main_pain_point_other"],
        message: "Required when pain point is Other",
      });
    }
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
    user_role_other: body.user_role_other,
    email_volume_other: body.email_volume_other,
    main_pain_point_other: body.main_pain_point_other,
  });

  return NextResponse.json({ ok: true });
}
