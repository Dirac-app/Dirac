import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FAST_MODEL } from "@/lib/model-config";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";
import { getThreadMessages as getGmailThreadMessages } from "@/lib/gmail";
import { getOutlookThreadMessages } from "@/lib/outlook";
import { getOutlookAccessToken } from "@/lib/outlook-token";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// How many of the top-ranked cards get full-body grounding.
// The rest fall back to the provider-supplied snippet so the model isn't flying blind.
const BODY_FETCH_TOP_N = 3;
// Per-thread body fetch timeout. Kept short so a slow provider doesn't hold
// up the whole enrichment — we'd rather fall back to snippets.
const BODY_FETCH_TIMEOUT_MS = 1800;
// Cap per-email body length fed into the prompt to keep token usage in check.
const BODY_MAX_CHARS = 1600;

const SYSTEM_PROMPT = `You are analyzing email threads for a morning briefing shown to a busy founder/operator.

For EACH thread provided, return THREE fields:

1. "summary": 1-2 sentences describing what this email is actually about. Be factual and specific. Do NOT mention what the user should do, no next steps, no advice — just what the email says or is about.

2. "needsAction": true if the user needs to do anything at all (reply, read, decide, archive, delete, etc.), false only if it is purely passive tracking with nothing required.

3. "plan": ONE concrete, specific action sentence — a plan the user can accept and execute verbatim.

   Rules for "plan":
   - Ground it in the actual content of THIS email. Reference the specific ask, topic, person, number, or deadline — prefer details from the full Body when present, falling back to the Preview.
   - Start with an imperative verb (Reply, Confirm, Ask, Decline, Send, Forward, Review, Archive, Schedule, Approve, Push back, Loop in, …).
   - Max ~22 words. No hedging ("maybe", "consider", "decide whether to"). No meta-advice ("think about", "evaluate priority").
   - If needsAction is false, plan = a one-line dismissal like "Skim for context, then archive — no reply needed."
   - NEVER output generic filler like "Draft a concise reply" or "Review and respond" — if you can't produce a specific plan, write one that names the key detail from the body/snippet (e.g., "Confirm the Thursday 3pm slot Sam proposed.").
   - The signals block tells you urgency, sender type, commitment count, and age — use them to sharpen tone (urgent → decisive; outreach → quick triage; waiting_on → nudge or drop).

Return ONLY a JSON array, no markdown fences, no extra text:
[{"threadId":"...","summary":"...","needsAction":true,"plan":"..."}]`;

interface CardInput {
  threadId: string;
  subject: string;
  sender: string;
  snippet: string;
  platform?: string; // "GMAIL" | "OUTLOOK" | "DISCORD" — controls body fetching
  triage?: string;
  category?: string;
  isUrgent?: boolean;
  commitmentCount?: number;
  ageLabel?: string;
}

interface CardResult {
  threadId: string;
  summary: string;
  needsAction: boolean;
  plan: string;
}

// Strip HTML tags and collapse whitespace — just good enough for the model to
// read. Not meant to be a full sanitizer.
function normalizeBodyText(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Pull a reasonable-length body excerpt for a single card. Returns null on
// any failure (auth missing, timeout, provider error, etc).
async function fetchBodyForCard(
  card: CardInput,
  gmailToken: string | null,
  outlookToken: string | null,
): Promise<string | null> {
  const platform = (card.platform || "").toUpperCase();

  // Wrap in a Promise.race for timeout — the provider libs don't expose a
  // signal, so this is the simplest guard.
  const withTimeout = <T,>(p: Promise<T>): Promise<T | null> =>
    Promise.race([
      p,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), BODY_FETCH_TIMEOUT_MS)),
    ]);

  try {
    if (platform === "GMAIL" && gmailToken) {
      const thread = await withTimeout(getGmailThreadMessages(gmailToken, card.threadId));
      if (!thread) return null;
      const first = thread.messages?.[0];
      if (!first) return null;
      // Prefer text body; fall back to normalized HTML.
      const raw = (first.bodyText?.trim() || normalizeBodyText(first.bodyHtml || "")).trim();
      if (!raw) return null;
      return raw.slice(0, BODY_MAX_CHARS);
    }

    if (platform === "OUTLOOK" && outlookToken) {
      const msgs = await withTimeout(getOutlookThreadMessages(outlookToken, card.threadId));
      if (!msgs || msgs.length === 0) return null;
      const first = msgs[0];
      const contentType = first.body?.contentType?.toLowerCase();
      const content = first.body?.content ?? "";
      const raw =
        contentType === "html" ? normalizeBodyText(content) : content.replace(/\s+/g, " ").trim();
      if (!raw) return null;
      return raw.slice(0, BODY_MAX_CHARS);
    }

    // Discord / unknown platforms — no body fetch path; caller falls back to snippet.
    return null;
  } catch (err) {
    console.error(`morning-cards body fetch failed for ${card.threadId}:`, err);
    return null;
  }
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

  // Resolve provider tokens once so top-N body fetches can share them.
  const gmailToken =
    session.accessToken && session.gmailConnected ? session.accessToken : null;
  const outlookToken = session.userId
    ? await getOutlookAccessToken(session.userId).catch(() => null)
    : null;

  // Fetch bodies for the top-N cards in parallel. These are assumed to be
  // ordered client-side by score, so index 0 is the most important.
  const bodyTargets = cards.slice(0, BODY_FETCH_TOP_N);
  const bodies = await Promise.all(
    bodyTargets.map((c) => fetchBodyForCard(c, gmailToken, outlookToken)),
  );
  const bodyMap = new Map<string, string>();
  bodyTargets.forEach((c, i) => {
    const b = bodies[i];
    if (b) bodyMap.set(c.threadId, b);
  });

  const contextText = cards
    .map((c, i) => {
      const signals: string[] = [];
      if (c.isUrgent) signals.push("URGENT");
      if (c.triage) signals.push(`triage=${c.triage}`);
      if (c.category) signals.push(`sender=${c.category}`);
      if (c.commitmentCount && c.commitmentCount > 0)
        signals.push(`${c.commitmentCount} open commitment${c.commitmentCount === 1 ? "" : "s"}`);
      if (c.ageLabel) signals.push(`age=${c.ageLabel}`);
      const signalsLine = signals.length ? `\nSignals: ${signals.join(" · ")}` : "";

      const fullBody = bodyMap.get(c.threadId);
      const bodyBlock = fullBody
        ? `\nBody:\n${fullBody}`
        : `\nPreview: ${c.snippet?.trim() || "(no preview available)"}`;

      return `Thread ${i + 1}:\nID: ${c.threadId}\nSubject: ${c.subject}\nFrom: ${c.sender}${bodyBlock}${signalsLine}`;
    })
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
      10_000,
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
