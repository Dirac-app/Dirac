import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { resolveModel } from "@/lib/model-config";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface QuickDraftOption {
  id: string;
  label: string;
  body: string;
}

interface ThreadMessage {
  from: string;
  body: string;
  sentAt: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimiters.quickDrafts.check(session.userId ?? session.user.email ?? "anonymous");
  if (!rl.ok) return rateLimitResponse(rl);

  const apiKey =
    (await getApiKeyForUser(session.userId ?? "").catch(() => null)) ??
    process.env.OPENROUTER_API_KEY ??
    null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 503 });
  }

  const body = await request.json();
  const {
    actionLabel,
    threadSubject,
    messages,
    toneProfile,
    preset,
  }: {
    actionLabel: string;
    threadSubject: string;
    messages?: ThreadMessage[];
    toneProfile?: Record<string, unknown>;
    preset?: string;
  } = body;

  const threadContext = messages?.length
    ? messages
        .slice(-6)
        .map((m) => `[${m.from}]: ${m.body.slice(0, 300)}`)
        .join("\n\n")
    : "(no thread context available)";

  const toneContext = toneProfile
    ? `\nUser's tone profile: ${JSON.stringify(toneProfile)}`
    : "";

  const systemPrompt = `You generate ready-to-send email draft options for a busy founder.

Given an action type and thread context, generate exactly 3 draft options. Each option should:
- Be ready to send as-is (no placeholders, no brackets)
- Vary meaningfully in approach: e.g., gentle vs. direct vs. assertive, or brief vs. detailed, or different framing
- Be concise (1–4 sentences typically)
- Match the user's tone profile if provided
- Use plain text (no markdown formatting in the body)

Return ONLY a JSON array, no markdown fences, no extra text:
[
  {"id":"1","label":"Short label for this approach","body":"The full ready-to-send email body"},
  {"id":"2","label":"Short label for this approach","body":"The full ready-to-send email body"},
  {"id":"3","label":"Short label for this approach","body":"The full ready-to-send email body"}
]${toneContext}`;

  const userPrompt = `Action: ${actionLabel}
Thread subject: "${threadSubject}"

Recent thread messages:
${threadContext}

Generate 3 different draft options for the above action.`;

  try {
    const response = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Dirac",
        },
        body: JSON.stringify({
          model: resolveModel("standard", preset),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      },
      10000,
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("quick-drafts AI error:", errText);
      return NextResponse.json({ error: "AI call failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let options: QuickDraftOption[];
    try {
      options = JSON.parse(cleaned);
    } catch {
      console.error("quick-drafts: failed to parse JSON:", cleaned.slice(0, 300));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ options });
  } catch (err) {
    console.error("quick-drafts error:", err);
    return NextResponse.json({ error: "Failed to generate drafts" }, { status: 500 });
  }
}
