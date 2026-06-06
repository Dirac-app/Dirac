import type { ToneProfile } from "@/lib/store";

export type DetailLevel = "brief" | "balanced" | "detailed";

export const DEFAULT_DETAIL_LEVEL: DetailLevel = "balanced";
export const DETAIL_LEVEL_KEY = "dirac-ai-detail";

export const DETAIL_LEVEL_ORDER: DetailLevel[] = ["brief", "balanced", "detailed"];

export const DETAIL_LEVEL_META: Record<
  DetailLevel,
  { label: string; description: string }
> = {
  brief: {
    label: "Brief",
    description: "Short, direct answers. Bullets only when they save time.",
  },
  balanced: {
    label: "Balanced",
    description: "Default depth. Structured and conversational, not wordy.",
  },
  detailed: {
    label: "Detailed",
    description: "Thorough answers with headers, lists, and tables when useful.",
  },
};

const CONTEXT_LABELS: Record<string, string> = {
  cold_outreach: "cold outreach / first contact",
  client_customer: "client or customer replies",
  internal_team: "internal team / coworkers",
  formal_professional: "formal professional communication",
  casual_personal: "casual / personal conversations",
  follow_ups: "follow-ups and reminders",
};

/** True when the user's analyzed writing style already uses em dashes. */
export function toneProfileUsesEmDash(profile: ToneProfile): boolean {
  const texts = [
    profile.summary,
    profile.greeting_style,
    profile.signoff_style,
    ...profile.traits,
    ...profile.example_phrases,
    ...(profile.conditional_tones?.flatMap((ct) => [
      ct.tone,
      ...ct.traits,
      ...ct.example_phrases,
    ]) ?? []),
  ];
  return texts.some((t) => t.includes("—") || /\s--\s/.test(t));
}

export function buildPunctuationRules(profile?: ToneProfile | null): string {
  if (profile && toneProfileUsesEmDash(profile)) {
    return `## Punctuation
- In email drafts, em dashes (—) are allowed only when they match this user's natural style from their tone profile.
- In chat responses, avoid em dashes unless the user explicitly asks for them in this conversation.
- When unsure, prefer commas, periods, colons, or parentheses.`;
  }
  return `## Punctuation
- NEVER use em dashes (—) in chat responses or email drafts.
- Use commas, periods, colons, or parentheses instead.
- Only use em dashes if the user explicitly requests them in this conversation.`;
}

export function buildDetailLevelInstruction(level: DetailLevel): string {
  switch (level) {
    case "brief":
      return `## Response detail: Brief
- Keep chat answers very short: usually 1–3 sentences or a tight bullet list.
- Skip preamble and filler ("Certainly!", "Great question!", "I'd be happy to…").
- Lead with the answer or recommendation, then one line of context if needed.
- Use markdown structure only when it clearly improves scanability.`;
    case "detailed":
      return `## Response detail: Detailed
- Give thorough, well-structured answers when the question warrants it.
- Use markdown: ## section headers, bullet lists, **bold** for key terms, and tables for comparisons or multi-item summaries.
- Still stay conversational and direct; depth does not mean verbosity.
- For simple yes/no questions, stay brief even in detailed mode.`;
    default:
      return `## Response detail: Balanced
- Default to concise, conversational answers (~80–150 words unless the user asks for more).
- Use markdown structure (headers, bullets, tables) when organizing 3+ items or comparing options.
- Sound like a sharp colleague, not a corporate chatbot.
- Lead with the takeaway, then supporting detail.`;
  }
}

export function buildToneInstruction(profile: ToneProfile): string {
  let toneInstruction = `## User's writing style (match this in all drafts and compose bodies)\n`;
  toneInstruction += `Default tone: ${profile.summary}\n`;
  if (profile.formality) toneInstruction += `Default formality: ${profile.formality}\n`;
  if (profile.traits.length > 0)
    toneInstruction += `Key traits: ${profile.traits.join(", ")}\n`;
  if (profile.greeting_style)
    toneInstruction += `Typical greeting: ${profile.greeting_style}\n`;
  if (profile.signoff_style)
    toneInstruction += `Typical sign-off: ${profile.signoff_style}\n`;
  if (profile.example_phrases.length > 0)
    toneInstruction += `Characteristic phrases (use naturally, not every sentence): ${profile.example_phrases.map((p) => `"${p}"`).join(", ")}\n`;

  if (profile.conditional_tones && profile.conditional_tones.length > 0) {
    toneInstruction += `\n## Contextual tone shifts\nThis user writes DIFFERENTLY depending on context. Match the appropriate tone:\n`;
    for (const ct of profile.conditional_tones) {
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

  toneInstruction += `\n
## Draft voice rules
- Write like this user, not like a generic AI. Mirror their greeting, sign-off, sentence length, and vocabulary.
- Avoid boilerplate ("I hope this email finds you well", "Please don't hesitate to reach out").
- Vary rhythm: mix short and medium sentences the way a real person would.
- Draft bodies are plain text only (no markdown inside \`\`\`draft or compose JSON).
- Do NOT mention or reference the tone profile itself.`;

  return toneInstruction;
}

export function buildQuickDraftToneContext(profile: ToneProfile): string {
  return `\n${buildToneInstruction(profile)}\n${buildPunctuationRules(profile)}`;
}

export function parseDetailLevel(value: string | null | undefined): DetailLevel {
  if (value && DETAIL_LEVEL_ORDER.includes(value as DetailLevel)) {
    return value as DetailLevel;
  }
  return DEFAULT_DETAIL_LEVEL;
}
