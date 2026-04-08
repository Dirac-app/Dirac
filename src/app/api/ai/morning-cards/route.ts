import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FAST_MODEL } from "@/lib/model-config";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are analyzing email threads for a morning briefing.

For EACH thread provided, return:
1. "summary": 1-2 sentences describing what this email is actually about. Be factual and specific. Do NOT mention what the user should do, no next steps, no advice — just what the email says or is about.
2. "needsAction": true if the user needs to do anything at all (reply, read carefully, make a decision, archive, delete, etc.), false only if it is purely passive tracking with absolutely nothing required of the user.

Return ONLY a JSON array, no markdown fences, no extra text:
[{"threadId":"...","summary":"...","needsAction":true}]`;

interface CardInput {
  threadId: string;
  subject: string;
  sender: string;
  snippet: string;
}

interface CardResult {
  threadId: string;
  summary: string;
  needsAction: boolean;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey =
    (await getApiKeyForUser(session.userId ?? "").catch(() => null)) ??
    process.env.OPENROUTER_API_KEY ??
    null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 503 });
  }

  const rl = rateLimiters.background.check(session.userId ?? session.user?.email ?? "anonymous");
  if (!rl.ok) return rateLimitResponse(rl);

  const body = await request.json();
  const cards: CardInput[] = body.cards ?? [];
  if (cards.length === 0) return NextResponse.json({ cards: [] });

  const contextText = cards
    .map(
      (c, i) =>
        `Thread ${i + 1}:\nID: ${c.threadId}\nSubject: ${c.subject}\nFrom: ${c.sender}\nPreview: ${c.snippet?.trim() || "(no preview available)"}`,
    )
    .join("\n\n");

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
          model: FAST_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: contextText },
          ],
          temperature: 0.2,
        }),
      },
      8000,
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("morning-cards AI error:", errText);
      return NextResponse.json({ error: "AI call failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let result: CardResult[];
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("morning-cards: failed to parse JSON:", cleaned.slice(0, 300));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ cards: result });
  } catch (err) {
    console.error("morning-cards error:", err);
    return NextResponse.json({ error: "Failed to generate summaries" }, { status: 500 });
  }
}
