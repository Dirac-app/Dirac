// Recently-sent emails initiated by the AI sidebar (or any sidebar-driven
// send path). Persisted to localStorage so that:
//   1. The chat route can include them in system context — letting the AI
//      avoid duplicate sends when the user iterates on a draft, and refer
//      back to "yes I already sent that one" without confusion.
//   2. Subsequent morning briefings can know "I already emailed Sarah
//      about Tuesday this morning" without re-suggesting it.
//
// Reply sends through `handleSendDraft` are NOT recorded here — those are
// already represented in the user's actual sent folder via the platform
// API and don't need to be re-injected as system context.

const RECENT_SENDS_KEY = "dirac_recent_sends";
const RECENT_SENDS_MAX = 30;             // cap memory + token budget
const RECENT_SENDS_TTL_MS = 7 * 86_400_000; // forget after a week

export interface RecentSend {
  id: string;
  to: string;       // lowercase email address
  subject: string;
  bodyPreview: string; // first ~120 chars, no PII beyond what we sent
  sentAt: string;   // ISO
  threadId?: string; // populated if the platform returns one
}

function genId(): string {
  return `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadRecentSends(): RecentSend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SENDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSend[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RECENT_SENDS_TTL_MS;
    return parsed
      .filter(
        (r): r is RecentSend =>
          !!r &&
          typeof r.id === "string" &&
          typeof r.to === "string" &&
          typeof r.sentAt === "string" &&
          new Date(r.sentAt).getTime() >= cutoff,
      )
      .slice(0, RECENT_SENDS_MAX);
  } catch {
    return [];
  }
}

export function recordRecentSend(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}): RecentSend {
  const entry: RecentSend = {
    id: genId(),
    to: input.to.trim().toLowerCase(),
    subject: input.subject.trim(),
    bodyPreview: input.body.replace(/\s+/g, " ").slice(0, 120),
    sentAt: new Date().toISOString(),
    threadId: input.threadId,
  };

  if (typeof window !== "undefined") {
    try {
      const current = loadRecentSends();
      const next = [entry, ...current].slice(0, RECENT_SENDS_MAX);
      window.localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(next));
    } catch {}
  }

  return entry;
}
