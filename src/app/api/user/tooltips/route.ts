import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabaseUser } from "@/lib/api-auth";
import { dismissTooltip, type InboxTooltipId } from "@/lib/users-db";

const BodySchema = z.object({
  tooltip_id: z.enum(["morning_brief", "ai_sidebar"]),
});

export async function PATCH(request: Request) {
  const auth = await requireSupabaseUser();
  if (auth.response) return auth.response;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await dismissTooltip(auth.user.id, body.tooltip_id as InboxTooltipId);
  return NextResponse.json({ ok: true });
}
