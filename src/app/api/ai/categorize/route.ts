import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FAST_MODEL } from "@/lib/model-config";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You categorize emails for a power-user's inbox. For each thread, return TWO fields:

1. "category" — the sender's relationship type (fixed list):
   investor, customer, vendor, team, recruiter, pr_media, outreach, automated, personal

2. "tab" — a short PURPOSE-BASED grouping label (1-3 words, lowercase). This groups emails by WHAT THEY ARE ABOUT, NOT who sent them.

   CRITICAL: Do NOT use sender/brand names as tabs. Group by the PURPOSE or TYPE of email.
   
   - GitHub, GitLab, Vercel, Netlify, CircleCI build notifications → "builds & deploys" (NOT "github", NOT "vercel")
   - Stripe receipts, PayPal, invoices → "receipts" (NOT "stripe")
   - Instagram, Twitter, LinkedIn, TikTok notifications → "social" (NOT "instagram")
   - IndieHackers, Morning Brew, Substack, any newsletter → "newsletters" (NOT "indiehackers")
   - Sentry, Datadog, uptime alerts → "alerts" (NOT "sentry")
   - Login alerts, 2FA, password resets → "security"
   - Co-founders, employees, internal → "team"
   - VCs, angels, investors, board → "investors"
   - Job candidates, recruiters → "hiring"
   - Paying customers, user feedback → "customers"
   - Cold sales pitches, partnership spam → "outreach"
   - Friends, family, personal → "personal"
   
   Rules:
   - ALWAYS group by PURPOSE: "builds & deploys" not "github"; "newsletters" not "morning brew"; "social" not "instagram"
   - Multiple different senders with the same purpose MUST share the same tab
   - Aim for 4-8 total tabs across all threads. Too many tabs defeats the purpose.
   - Keep labels to 1-3 words

Key rules for "category":
- Base the decision on WHO sent it (sender name/email domain) more than the content.
- "automated" = sent by a machine, system, or no-reply address. Newsletters, digests, marketing = "automated".
- If isForward is true, categorize based on the ORIGINAL email's relationship.
- "vendor" = a company you pay for a service.
- "outreach" = unsolicited first contact from an unknown person trying to sell/partner.
- If the sender's email domain matches the user's teamDomain, category is always "team".`;

function buildSystemPrompt(teamDomain: string, existingTabs: string[]): string {
  let prompt = SYSTEM_PROMPT;
  if (teamDomain) {
    prompt += `\n\nThe user's company domain is "${teamDomain}". Any email from @${teamDomain} is category "team", tab "team".`;
  }
  if (existingTabs.length > 0) {
    prompt += `\n\nThe user already has these tabs: [${existingTabs.join(", ")}]. REUSE these tab names when appropriate — don't create a new tab if an existing one fits. But create new tabs if no existing tab matches.`;
  }
  return prompt;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getApiKeyForUser(session.userId ?? "").catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured. Please contact support." }, { status: 503 });
  }

  const rl = rateLimiters.background.check(session.userId ?? session.user?.email ?? "anonymous");
  if (!rl.ok) return rateLimitResponse(rl);

  const body = await request.json();
  if (!body.threads?.length) {
    return NextResponse.json({ results: [] });
  }

  const teamDomain: string = typeof body.teamDomain === "string" ? body.teamDomain.toLowerCase() : "";
  const existingTabs: string[] = Array.isArray(body.existingTabs) ? body.existingTabs : [];
  const sample = body.threads.slice(0, 30);

  const threadsText = sample
    .map(
      (t: { threadId: string; subject: string; snippet: string; from: string; fromName: string; messageCount?: number; participantCount?: number; isForward?: boolean }, i: number) => {
        const meta: string[] = [];
        if (t.messageCount && t.messageCount > 1) meta.push(`${t.messageCount} messages`);
        if (t.participantCount && t.participantCount > 2) meta.push(`${t.participantCount} participants`);
        if (t.isForward) meta.push("forwarded");
        const metaStr = meta.length ? ` [${meta.join(", ")}]` : "";
        return `${i + 1}. [${t.threadId}]${metaStr}\n   From: ${t.fromName} <${t.from}>\n   Subject: ${t.subject}\n   Snippet: ${t.snippet}`;
      },
    )
    .join("\n\n");

  const systemPrompt = buildSystemPrompt(teamDomain, existingTabs) + `\n\nReturn ONLY a JSON array (no markdown fences):\n[{"threadId": "...", "category": "investor"|"customer"|"vendor"|"team"|"recruiter"|"pr_media"|"outreach"|"automated"|"personal", "tab": "short label"}]`;

  try {
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Categorize these email threads:\n\n${threadsText}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter categorize error:", errText);
      return NextResponse.json(
        { error: "AI categorization failed" },
        { status: 502 },
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    let results: unknown;
    try {
      results = JSON.parse(cleaned);
    } catch {
      console.error("Categorize: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Categorize error:", err);
    return NextResponse.json(
      { error: "Failed to categorize" },
      { status: 500 },
    );
  }
}
