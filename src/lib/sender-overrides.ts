// Manual @sender-type overrides. Users configure these in Settings → Sender rules.
// When a rule matches an incoming thread's sender, we use the mapped category
// verbatim and skip the AI classification path. Domain rules let users categorize
// entire orgs at once (e.g. "@vc.com" → investor).

import type { FounderCategory } from "@/lib/types";

export const SENDER_OVERRIDES_LS_KEY = "dirac-sender-overrides";
export const SENDER_OVERRIDES_CHANGED_EVENT = "dirac:sender-overrides-changed";

export interface SenderOverride {
  id: string;
  // Either a full email ("sam@acme.com") or a domain ("acme.com" or "@acme.com").
  // Stored lowercase, no leading "@" for domains.
  pattern: string;
  category: FounderCategory;
}

function genId(): string {
  return `so_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Normalize a user-provided pattern. Returns null if it's not a usable rule.
// Accepts:
//   "Sam@Acme.com"        → { kind: "email",  value: "sam@acme.com" }
//   "@acme.com"           → { kind: "domain", value: "acme.com" }
//   "acme.com"            → { kind: "domain", value: "acme.com" }
//   "  "                  → null
export function normalizePattern(
  raw: string,
): { kind: "email" | "domain"; value: string } | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.startsWith("@")) {
    const domain = trimmed.slice(1);
    if (!domain.includes(".")) return null;
    return { kind: "domain", value: domain };
  }

  const atCount = (trimmed.match(/@/g) ?? []).length;
  if (atCount === 1) {
    const [local, domain] = trimmed.split("@");
    if (!local || !domain || !domain.includes(".")) return null;
    return { kind: "email", value: trimmed };
  }

  // Bare domain (no "@"): must contain a dot and no whitespace
  if (!trimmed.includes(" ") && trimmed.includes(".")) {
    return { kind: "domain", value: trimmed };
  }

  return null;
}

export function loadSenderOverrides(): SenderOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SENDER_OVERRIDES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Defensive filter — strip anything that doesn't match the shape.
    return parsed.filter(
      (r): r is SenderOverride =>
        !!r &&
        typeof r === "object" &&
        typeof (r as SenderOverride).id === "string" &&
        typeof (r as SenderOverride).pattern === "string" &&
        typeof (r as SenderOverride).category === "string",
    );
  } catch {
    return [];
  }
}

export function saveSenderOverrides(overrides: SenderOverride[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENDER_OVERRIDES_LS_KEY, JSON.stringify(overrides));
    // Notify other hooks/providers in this tab. `storage` only fires across tabs,
    // so we dispatch a custom event to cover same-tab listeners.
    window.dispatchEvent(new CustomEvent(SENDER_OVERRIDES_CHANGED_EVENT));
  } catch {}
}

export function addSenderOverride(
  pattern: string,
  category: FounderCategory,
): SenderOverride | null {
  const norm = normalizePattern(pattern);
  if (!norm) return null;
  const entry: SenderOverride = {
    id: genId(),
    pattern: norm.value,
    category,
  };
  const current = loadSenderOverrides();
  // De-dupe on pattern — latest wins.
  const deduped = current.filter((r) => r.pattern !== entry.pattern);
  saveSenderOverrides([...deduped, entry]);
  return entry;
}

export function removeSenderOverride(id: string): void {
  const current = loadSenderOverrides();
  saveSenderOverrides(current.filter((r) => r.id !== id));
}

// Match a sender email against the rule list. Email rules beat domain rules;
// among domain rules, longer/more specific domains beat shorter ones.
export function matchSenderOverride(
  senderEmail: string,
  overrides: SenderOverride[],
): FounderCategory | null {
  if (!senderEmail) return null;
  const addr = senderEmail.trim().toLowerCase();
  if (!addr.includes("@")) return null;
  const domain = addr.split("@")[1] ?? "";

  // 1. Exact email match wins
  for (const r of overrides) {
    if (r.pattern === addr) return r.category;
  }

  // 2. Domain match — longest suffix wins to handle subdomains sensibly
  //    (e.g. "mail.acme.com" should prefer a "mail.acme.com" rule over "acme.com")
  let best: SenderOverride | null = null;
  for (const r of overrides) {
    if (r.pattern.includes("@")) continue; // email rules already handled
    const pat = r.pattern;
    if (domain === pat || domain.endsWith(`.${pat}`)) {
      if (!best || pat.length > best.pattern.length) best = r;
    }
  }
  return best?.category ?? null;
}

export function describeOverride(r: SenderOverride): string {
  return r.pattern.includes("@") ? r.pattern : `@${r.pattern}`;
}
