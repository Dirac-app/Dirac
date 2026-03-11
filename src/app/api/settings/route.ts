import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { validateBody, SettingsPatchSchema } from "@/lib/validation";
import { getUserSettings, updateUserSettings } from "@/lib/user-db";

const DEFAULTS = {
  aiModel: process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001",
  aboutMe: "",
  hasApiKey: !!process.env.OPENROUTER_API_KEY,
};

export async function GET() {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = await getUserSettings(guard.userId!) as any;
    return NextResponse.json({
      aiModel: settings.aiModel ?? DEFAULTS.aiModel,
      aboutMe: settings.aboutMe ?? "",
      // Return whether a key is set, but NEVER return the actual key value
      hasApiKey: !!(settings.openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY),
      hasOwnApiKey: !!settings.openrouterApiKey?.trim(),
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const parsed = await validateBody(request, SettingsPatchSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const patch: { aiModel?: string; aboutMe?: string; openrouterApiKey?: string | null } = {};
    if (typeof parsed.data.aiModel === "string") patch.aiModel = parsed.data.aiModel.trim();
    if (typeof parsed.data.aboutMe === "string") patch.aboutMe = parsed.data.aboutMe.trim();
    if (typeof parsed.data.openrouterApiKey === "string") {
      // Empty string = clear the key; otherwise store it
      patch.openrouterApiKey = parsed.data.openrouterApiKey.trim() || null;
    } else if (parsed.data.openrouterApiKey === null) {
      patch.openrouterApiKey = null;
    }
    await updateUserSettings(guard.userId!, patch);
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    console.error("[settings] update failed:", err);
    return NextResponse.json({ ok: true, persisted: false });
  }
}
