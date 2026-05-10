import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";
import { FAST_MODEL } from "@/lib/model-config";
import { z } from "zod";
import type { ExtractionResult, RelationshipMemory, MemoryEntry } from "@/lib/user-memory";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── Schema ──────────────────────────────────────────────────────────────────

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20_000),
});

const ExistingRelSchema = z.object({
  email: z.string().max(320),
  name: z.string().max(200),
  roleContext: z.string().max(200),
  notes: z.string().max(500),
});

const RequestSchema = z.object({
  sessionId: z.string().max(100),
  transcript: z.array(TurnSchema).min(2).max(120),
  existingRelationships: z.array(ExistingRelSchema).max(25).optional(),
});

// ─── Extraction prompt ────────────────────────────────────────────────────────
//
// Deliberately conservative — only pull out things the user EXPLICITLY said
// or that are clearly evident from their words. No inferences. No speculation.

const SYSTEM_PROMPT = `You are a memory extraction assistant for an AI email client called Dirac.

Given a transcript of a user's AI chat session, extract only facts that are:
1. Clearly stated (not inferred or guessed)
2. Useful to remember across future sessions (people, commitments, decisions, ongoing projects)
3. Not already covered by the existing relationship notes

DO NOT include:
- Emotional states or speculations about the user
- Facts that are only relevant within this one session
- Duplicate information already in existing relationship notes

You MUST respond with valid JSON matching EXACTLY this schema:
{
  "newMemories": [
    {
      "id": "<unique-string>",
      "content": "<1-2 sentence factual statement>",
      "tags": ["<lowercase-name-or-topic>", ...],
      "createdAt": "<ISO timestamp>"
    }
  ],
  "relationshipUpdates": [
    {
      "email": "<email>",
      "name": "<display name>",
      "roleContext": "<their relationship to the user in 10 words or less>",
      "notes": "<max 2 sentences of current status/context>",
      "lastUpdated": "<ISO timestamp>"
    }
  ]
}

Rules:
- newMemories: max 5 per session. Only commitments, decisions, newly learned contact facts, or project status changes.
- relationshipUpdates: only include contacts that were MENTIONED in this session AND whose information has changed or is new.
- If nothing meaningful was discussed, return empty arrays for both fields.
- Respond with ONLY the JSON object — no markdown fences, no explanation.`;

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.response;

  const rl = rateLimiters.chat.check(guard.userId ?? "anonymous");
  if (!rl.ok) return rateLimitResponse(rl);

  const apiKey =
    (await getApiKeyForUser(guard.userId!).catch(() => null)) ??
    process.env.OPENROUTER_API_KEY ??
    null;

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 422 },
    );
  }

  const { transcript, existingRelationships = [] } = parsed.data;

  // Build the user message — the transcript + existing context
  const transcriptText = transcript
    .map((t) => `${t.role === "user" ? "User" : "Dirac AI"}: ${t.content}`)
    .join("\n\n");

  let userMessage = `Here is the chat transcript to extract memory from:\n\n${transcriptText}`;

  if (existingRelationships.length > 0) {
    const existingText = existingRelationships
      .map((r) => `- ${r.name} <${r.email}> [${r.roleContext}]: ${r.notes}`)
      .join("\n");
    userMessage += `\n\n---\nExisting relationship notes (do NOT duplicate these — only include updates or new contacts):\n${existingText}`;
  }

  const now = new Date().toISOString();
  userMessage += `\n\n---\nCurrent timestamp: ${now}`;

  try {
    const response = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://app.dirac.email",
          "X-Title": "Dirac Email",
        },
        body: JSON.stringify({
          model: FAST_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 1200,
          stream: false,
        }),
      },
      15_000,
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[extract-memory] LLM error:", response.status, errText);
      return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content ?? "";

    let extraction: ExtractionResult;
    try {
      // Strip any accidental markdown fences
      const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const obj = JSON.parse(clean) as Partial<ExtractionResult>;

      extraction = {
        newMemories: (Array.isArray(obj.newMemories) ? obj.newMemories : []).slice(0, 5) as MemoryEntry[],
        relationshipUpdates: (Array.isArray(obj.relationshipUpdates) ? obj.relationshipUpdates : []).slice(0, 10) as RelationshipMemory[],
      };
    } catch (e) {
      console.error("[extract-memory] JSON parse failed:", e, "\nContent:", content);
      // Return empty extraction — memory stays as-is, don't crash the client
      extraction = { newMemories: [], relationshipUpdates: [] };
    }

    return NextResponse.json(extraction);
  } catch (err) {
    console.error("[extract-memory] Fetch error:", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
