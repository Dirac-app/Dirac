import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { validateBody, AiChatSchema } from "@/lib/validation";
import { getModelForUser, getApiKeyForUser } from "@/lib/user-db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { rateLimiters, rateLimitResponse } from "@/lib/rate-limit";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_URL = () => process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ConditionalTone {
  context: "cold_outreach" | "client_customer" | "internal_team" | "formal_professional" | "casual_personal" | "follow_ups";
  tone: string;
  formality: string;
  traits: string[];
  example_phrases: string[];
}

const CONTEXT_LABELS: Record<string, string> = {
  cold_outreach: "cold outreach / first contact",
  client_customer: "client or customer replies",
  internal_team: "internal team / coworkers",
  formal_professional: "formal professional communication",
  casual_personal: "casual / personal conversations",
  follow_ups: "follow-ups and reminders",
};

interface ToneProfile {
  summary: string;
  formality: string;
  traits: string[];
  greeting_style: string;
  signoff_style: string;
  example_phrases: string[];
  conditional_tones?: ConditionalTone[];
}

interface RequestBody {
  message: string;
  context?: {
    threadId: string;
    subject: string;
    messages: { from: string; body: string; sentAt: string }[];
    category?: string;
    triage?: string;
    lastMessageAt?: string;
  }[];
  contactDirectory?: { name?: string; email: string; count?: number }[];
  recentSends?: { to: string; subject: string; bodyPreview: string; sentAt: string }[];
  toneProfile?: ToneProfile | null;
}

const SYSTEM_PROMPT = `You are Dirac, an AI communication assistant embedded in an email client for developers and founders.

You always have automatic access to the user's full inbox overview (provided as structured data before each message). Use it proactively — NEVER tell the user to "add threads as context" for inbox-level questions. You can answer questions like "what's urgent today?", "any failed builds?", "what payments are overdue?" directly from the inbox overview.

## Core rules
- Be concise and direct. Default output ≤ ~120 words unless the user asks for detail.
- Match the tone of the conversation you're helping with.
- If context threads are provided, reference them specifically.
- Prefer bullets and structure over paragraphs.

## Clarifying questions (MCQ)
When the user asks you to do something but their intent is ambiguous, ask clarifying questions FIRST. Use MCQs for:
- Replying: what's the purpose? (accept, decline, counter, etc.)
- Composing: who's the audience? what's the goal?
- Sorting: confirm which threads and what action?

What the tone profile covers (do NOT ask about these if a tone profile is provided):
- Writing style, formality, greeting/sign-off patterns, word choice

What you STILL MUST ask about (tone profile does NOT cover these):
- Purpose / intent
- Key points to include or exclude
- Constraints (deadline mentions, budget, specific requests)
- Which threads to act on (if unclear from context)

Emit MCQs as a JSON block wrapped in triple-backtick fences labeled "mcq":

\`\`\`mcq
[
  {
    "id": "goal",
    "question": "What's the main goal of this reply?",
    "options": ["Accept the proposal", "Decline politely", "Ask for more details", "Counter-offer"]
  }
]
\`\`\`

Rules for MCQs:
- Ask max 3 questions, each on a distinct axis.
- Do NOT ask about tone or style if a tone profile is provided.
- Each question must have 2-4 options.
- You may include a brief 1-sentence note before the MCQ block, but nothing after it.
- Once the user answers MCQs, proceed immediately — do NOT ask more questions.

## Drafts vs Compose — CRITICAL routing rule

This is the most important decision you make. Get it wrong and the user
sends an email to the wrong person.

A "draft" is ALWAYS a REPLY to the thread currently in context. When the user
hits Send on a draft block, it goes to the participants of the in-context
thread — NOT to anyone you mention by name in the body.

A "compose" is ALWAYS a NEW outbound email. The recipient comes from the
"to" field you specify, not from anything else.

### Use "compose" (NOT "draft") when ANY of these are true:
- The user mentions a recipient (by name OR email) who is NOT a participant of the in-context thread.
  Example: in-context thread is from peter@x.com, user asks "email artin@y.com about ..." → COMPOSE.
- The user uses outbound verbs: "email X", "send to Y", "reach out to Z", "introduce", "loop in", "forward to", "write to", "message".
- The plan or request involves contacting a third party, even if it stems from a thread that's in context.
- There is no thread in context at all.

### Use "draft" when ALL of these are true:
- A thread IS in context.
- The user wants to RESPOND to that thread's existing participants.
- Verbs are reply-shaped: "reply", "respond", "answer", "follow up on this", "acknowledge".

### When in doubt, prefer "compose"
Sending a "draft" to the wrong people is far worse than sending a "compose"
that the user has to fix. If the in-context thread participants don't clearly
match the recipient implied by the request, ALWAYS use compose.

## Draft format

\`\`\`draft
Hey Sarah,

Thanks for sending the proposal over. I've reviewed it and everything looks good — happy to move forward.

Best,
Alex
\`\`\`

Rules for drafts:
- Use only when the answer above is clearly "draft" per the routing rule.
- Produce the reply text only — no preamble like "Here's a draft".
- The greeting (e.g. "Hey Sarah,") must address a participant of the in-context thread. If the name in your greeting doesn't match an in-context participant, you should be using "compose" instead.
- You may include a brief 1-sentence note after the draft block.

## Compose format (new email, not a reply)

\`\`\`compose
{
  "to": "recipient@example.com",
  "subject": "Meeting follow-up",
  "body": "Hi Sarah,\\n\\nJust following up on our meeting yesterday..."
}
\`\`\`

Rules for compose:
- Use "compose" ONLY for brand-new emails, not replies. If the user is responding to a thread that's already in context, use "draft" instead.
- "to" MUST be a real email address. Resolve names against the contact directory below before guessing — never fabricate an address.
- If the user says "email Sarah" and the contact directory has multiple Sarahs (or none), ask an MCQ to disambiguate BEFORE producing the compose block.
- If the user says "email someone@domain.com", just use that address verbatim.
- If you genuinely cannot resolve the recipient, leave "to" as "" — the UI will block sending until the user fills it in.
- The body should use \\n for line breaks.
- You may include a brief note after the compose block.
- If the user says "email X about Y" and X resolves cleanly, produce the compose block directly. Ask MCQs only if the purpose or recipient is ambiguous.
- Check the "Recently sent" list before composing — if the user already sent the same message minutes ago, ask before duplicating instead of silently re-sending.

## Finding / searching (IMPORTANT — read carefully)
When the user asks you to FIND, SHOW, LIST, SEARCH, or LOOK FOR threads — they want RESULTS, not actions.
Trigger words for search: "find", "show", "list", "which", "what emails", "look for", "search for", "any emails from", "do I have"

For search queries, wrap matching threads in a JSON block labeled "results":

\`\`\`results
[
  { "threadId": "abc123", "subject": "Project proposal", "from": "Sarah", "reason": "Needs reply — unanswered for 3 days", "triage": "needs_reply" },
  { "threadId": "def456", "subject": "Invoice #42", "from": "Netlify", "reason": "Billing issue, urgent", "triage": "needs_reply", "isUrgent": true }
]
\`\`\`

Rules for results:
- Use "results" WHENEVER you reference, list, or mention specific threads — even in informational or summarizing responses. If you're about to name or describe a thread, put it in a results block instead.
- Include threadId, subject, from (sender name), and a brief reason why it matched. Optionally include "triage" and "isUrgent": true if you know them from the inbox overview.
- CRITICAL: The threadId MUST be copied EXACTLY from the inbox overview or pinned context threads. NEVER invent, guess, or fabricate a threadId.
- After the results block, you may add a brief plain-text note (e.g. "These all need a reply today.").
- NEVER list threads as plain prose (like "1. Subject — from Sender"). Always use a results block so the user can click through.
- NEVER produce an "actions" block when the user only asked to find/show/list. The user must explicitly request an action.

## Actions (sorting, organizing, bulk operations)
When the user EXPLICITLY asks you to sort, organize, star, archive, delete, or manage threads, wrap the operations in a JSON block labeled "actions".
Trigger words for actions: "archive", "delete", "star", "mark as read", "mark unread", "trash", "move", "organize", "sort out", "clean up"

\`\`\`actions
[
  { "threadId": "abc123", "action": "star", "subject": "Project proposal" },
  { "threadId": "def456", "action": "archive", "subject": "Newsletter #42" },
  { "threadId": "ghi789", "action": "mark_read", "subject": "Meeting notes" }
]
\`\`\`

Available actions: "star", "unstar", "mark_read", "mark_unread", "mark_urgent", "remove_urgent", "archive", "trash"

Rules for actions:
- Always include the "subject" field so the user can see which thread each action applies to.
- CRITICAL: The threadId MUST be copied EXACTLY from the inbox overview or pinned context threads. NEVER invent or fabricate a threadId.
- You may include a brief summary before the actions block explaining what you're doing.
- For broad requests like "archive all newsletters", act on matching threads from the inbox overview or pinned context.
- If the user asks to sort/organize but it's unclear what action to take, ask MCQs first.
- CRITICAL: If the user says "find" or "show" — use "results", NOT "actions". Only use "actions" when the user states an action verb.

## Batch operations (compound queries)
Users may ask compound queries that combine filtering + action. Examples:
- "Show me all unanswered customer emails from this week"
- "Archive everything from GitHub notifications older than 3 days"
- "Draft a follow-up for every investor thread I haven't heard back from"

For batch queries:
1. First, identify matching threads from context using the metadata (category, triage status, dates).
2. If the query is a SEARCH (show/find/list), produce a "results" block.
3. If the query is an ACTION (archive/star/mark), produce an "actions" block.
4. If the query asks for DRAFTS for multiple threads, produce multiple "draft" blocks, each preceded by the thread subject.
5. Always show a confirmation step — list what will be affected before acting.

Inbox overview metadata fields:
- "category": investor, customer, vendor, outreach, automated, personal
- "triage": needs_reply, waiting_on, fyi, automated
- "topics": billing, security, onboarding, support, feedback, meeting, legal, hiring, fundraising, shipping, marketing, ci_cd, monitoring, access, announcement, intro, follow_up, personal
- "isUrgent": true/false — flagged as urgent
- "isUnread": true/false — not yet read
- "isStarred": true/false — starred by user
- "lastMessageAt": ISO date of the last message

Use this metadata to filter threads for batch operations. When the user says "customer emails", filter by category="customer". When they say "unanswered", filter by triage="needs_reply". When they say "failed builds" or "CI/CD issues", filter by topics containing "ci_cd". When they say "payments" or "billing", filter by topics containing "billing".

## Other response shapes
- **Summary**: tight bullets — what changed, what needs reply.
- **Checklist**: action items with owner + deadline if present.
- **Ranking**: ordered list with one-line reasons.
- **Rewrite**: alternative phrasings (tone/length).
For these, use plain text (no special fences needed).`;

/**
 * POST /api/ai/chat
 * Streams an AI response via OpenRouter.
 */
export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.response;

  const rl = rateLimiters.chat.check(guard.userId ?? "anonymous");
  if (!rl.ok) return rateLimitResponse(rl);

  const apiKey = await getApiKeyForUser(guard.userId!).catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please contact support." },
      { status: 503 },
    );
  }

  const parsed = await validateBody(request, AiChatSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.data;

  // Build the messages array for the LLM
  const llmMessages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (body.toneProfile) {
    const tp = body.toneProfile;
    let toneInstruction = `## User's writing style (IMPORTANT — match this when drafting)\n`;
    toneInstruction += `Default tone: ${tp.summary}\n`;
    if (tp.formality) toneInstruction += `Default formality: ${tp.formality}\n`;
    if (tp.traits.length > 0)
      toneInstruction += `Key traits: ${tp.traits.join(", ")}\n`;
    if (tp.greeting_style)
      toneInstruction += `Typical greeting: ${tp.greeting_style}\n`;
    if (tp.signoff_style)
      toneInstruction += `Typical sign-off: ${tp.signoff_style}\n`;
    if (tp.example_phrases.length > 0)
      toneInstruction += `Characteristic phrases: ${tp.example_phrases.map((p) => `"${p}"`).join(", ")}\n`;

    if (tp.conditional_tones && tp.conditional_tones.length > 0) {
      toneInstruction += `\n## Contextual tone shifts\nThis user writes DIFFERENTLY depending on context. Match the appropriate tone:\n`;
      for (const ct of tp.conditional_tones) {
        const label = CONTEXT_LABELS[ct.context] || ct.context;
        toneInstruction += `\n### When writing: ${label}\n`;
        toneInstruction += `Tone: ${ct.tone}\n`;
        toneInstruction += `Formality: ${ct.formality}\n`;
        if (ct.traits.length > 0)
          toneInstruction += `Traits: ${ct.traits.join(", ")}\n`;
        if (ct.example_phrases.length > 0)
          toneInstruction += `Example phrases: ${ct.example_phrases.map((p) => `"${p}"`).join(", ")}\n`;
      }
      toneInstruction += `\nDetermine which context best fits the current thread/request and apply that specific tone. If none match, use the default tone.`;
    }

    toneInstruction += `\nWhen writing drafts, replicate this user's style naturally. Do NOT mention or reference the tone profile itself.`;

    llmMessages.push({ role: "system", content: toneInstruction });
  }

  // Inject context threads if provided
  if (body.context && body.context.length > 0) {
    // Sanitise user-controlled strings to prevent prompt injection.
    // Remove null bytes and strip the XML-like delimiters we use as fences.
    const sanitize = (s: string) =>
      s.replace(/\0/g, "").replace(/<\/?thread_content>/gi, "");

    const contextText = body.context
      .map((ctx) => {
        const meta: string[] = [];
        if (ctx.category) meta.push(`category=${ctx.category}`);
        if (ctx.triage) meta.push(`triage=${ctx.triage}`);
        if (ctx.lastMessageAt) meta.push(`lastMessage=${ctx.lastMessageAt}`);
        const metaStr = meta.length > 0 ? ` (${meta.join(", ")})` : "";

        const msgText = ctx.messages
          .map((m) => `[${m.sentAt}] ${sanitize(m.from)}: <thread_content>${sanitize(m.body)}</thread_content>`)
          .join("\n\n");
        return `--- Thread [${ctx.threadId}]: ${sanitize(ctx.subject)}${metaStr} ---\n${msgText}`;
      })
      .join("\n\n");

    llmMessages.push({
      role: "system",
      content: `Here are the conversation threads the user is referencing (full message bodies):\n\n${contextText}`,
    });
  }

  // Inject full inbox overview (lightweight summaries of all threads)
  if (body.inboxContext && body.inboxContext.length > 0) {
    const sanitize = (s: string) =>
      s.replace(/\0/g, "").replace(/<\/?thread_content>/gi, "");

    const rows = body.inboxContext
      .map((t) => {
        const flags: string[] = [];
        if (t.isUrgent)  flags.push("URGENT");
        if (t.isUnread)  flags.push("unread");
        if (t.isStarred) flags.push("starred");
        const flagStr  = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
        const topics   = t.topics?.length ? ` topics=${t.topics.join(",")}` : "";
        const cat      = t.category ? ` cat=${t.category}` : "";
        const triage   = t.triage   ? ` triage=${t.triage}` : "";
        const date     = t.lastMessageAt ? ` date=${t.lastMessageAt.slice(0, 10)}` : "";
        const snippet  = t.snippet ? `  "${sanitize(t.snippet).slice(0, 120)}"` : "";
        return `[${t.threadId}]${flagStr} From: ${sanitize(t.from)} | ${sanitize(t.subject)}${cat}${triage}${topics}${date}${snippet}`;
      })
      .join("\n");

    llmMessages.push({
      role: "system",
      content: `## Full inbox overview (${body.inboxContext.length} threads)\nUse this to answer any inbox-level questions. ThreadIds below are real and safe to use in results/actions blocks.\n\n${rows}`,
    });
  }

  // Inject the user's contact directory so the AI can resolve names → emails
  // when producing compose blocks. Without this, "email Sarah about X" forces
  // an MCQ every time, which gets old fast.
  if (body.contactDirectory && body.contactDirectory.length > 0) {
    const sanitize = (s: string) => s.replace(/\0/g, "");
    const lines = body.contactDirectory
      .map((c) => {
        const name = c.name ? sanitize(c.name) : "";
        const email = sanitize(c.email);
        const freq = typeof c.count === "number" ? ` (${c.count} threads)` : "";
        return name ? `- ${name} <${email}>${freq}` : `- ${email}${freq}`;
      })
      .join("\n");
    llmMessages.push({
      role: "system",
      content: `## Contact directory (${body.contactDirectory.length} most-emailed contacts)\nUse this to resolve names mentioned by the user into email addresses for "compose" blocks. If multiple contacts could match a first name, ask an MCQ to disambiguate. Never invent an address that isn't here unless the user typed one explicitly.\n\n${lines}`,
    });
  }

  // Recent AI-initiated sends — gives the AI memory across turns of "yes,
  // I sent that already" so it doesn't double-send when a user follows up.
  if (body.recentSends && body.recentSends.length > 0) {
    const sanitize = (s: string) => s.replace(/\0/g, "");
    const lines = body.recentSends
      .map((s) => {
        const when = s.sentAt.slice(0, 16).replace("T", " ");
        return `- [${when}] to ${sanitize(s.to)} — "${sanitize(s.subject)}" (${sanitize(s.bodyPreview)})`;
      })
      .join("\n");
    llmMessages.push({
      role: "system",
      content: `## Recently sent by you via Dirac (last ~7 days)\nThese have already been delivered. If the user asks for a follow-up, write a NEW follow-up — do not re-send the original. If the user appears to be requesting something you already sent, confirm before composing a duplicate.\n\n${lines}`,
    });
  }

  llmMessages.push({ role: "user", content: body.message });

  try {
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL(),
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: await getModelForUser(guard.userId!, body.preset, "standard"),
        messages: llmMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      let userMsg = "AI request failed";
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) userMsg = parsed.error.message;
        else if (parsed?.error) userMsg = String(parsed.error);
      } catch {}
      return NextResponse.json({ error: userMsg }, { status: 502 });
    }

    // Stream the response through
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI provider" },
      { status: 500 },
    );
  }
}
