"use client";

// ─── User Memory ─────────────────────────────────────────────────────────────
//
// Persistent cross-session memory for the AI. Two layers:
//
//   RelationshipMemory  — one entry per person the user interacts with.
//                         Updated whenever a new chat mentions them.
//
//   MemoryEntry         — discrete facts, decisions, or commitments extracted
//                         from past sessions. Tagged with person names and
//                         topics so they can be filtered when relevant.
//
// Both are stored in localStorage (client-only, never sent to our servers).
// The full object is serialized into a compact plain-text block injected as
// a system message on every AI request — capped at ~350 tokens so it never
// crowds out real context.

export interface RelationshipMemory {
  email: string;         // canonical identifier
  name: string;
  roleContext: string;   // "investor at Sequoia", "design agency we hired"
  notes: string;         // freeform running notes, ~2 sentences max
  lastUpdated: string;   // ISO date
}

export interface MemoryEntry {
  id: string;
  content: string;       // 1–2 sentences, a single grounded fact or decision
  tags: string[];        // lowercase person names + topic keywords
  createdAt: string;     // ISO date
}

export interface UserMemory {
  // Who the user deals with regularly.
  // Capped at 25 entries; LRU eviction when full.
  relationships: RelationshipMemory[];

  // Discrete facts from past sessions, newest first.
  // Capped at 40 entries; oldest evicted when full.
  recentMemories: MemoryEntry[];

  // When the most recent extraction ran. Used to skip extraction if the
  // session was too short to be worth processing.
  lastExtractedSessionId: string | null;
}

const MEMORY_KEY = "dirac_user_memory";
const REL_CAP = 25;
const ENTRY_CAP = 40;

const EMPTY_MEMORY: UserMemory = {
  relationships: [],
  recentMemories: [],
  lastExtractedSessionId: null,
};

// ─── Storage ─────────────────────────────────────────────────────────────────

export function loadUserMemory(): UserMemory {
  if (typeof window === "undefined") return EMPTY_MEMORY;
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return EMPTY_MEMORY;
    return { ...EMPTY_MEMORY, ...(JSON.parse(raw) as Partial<UserMemory>) };
  } catch {
    return EMPTY_MEMORY;
  }
}

export function saveUserMemory(mem: UserMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
  } catch {}
}

export function clearUserMemory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MEMORY_KEY);
  } catch {}
}

// ─── Merging extracted facts back into memory ─────────────────────────────────

export interface ExtractionResult {
  newMemories: MemoryEntry[];
  relationshipUpdates: RelationshipMemory[];
}

export function applyExtraction(
  current: UserMemory,
  extraction: ExtractionResult,
  sessionId: string,
): UserMemory {
  // --- Merge relationships (upsert by email) ---
  const rels = [...current.relationships];
  for (const update of extraction.relationshipUpdates) {
    const idx = rels.findIndex(
      (r) => r.email.toLowerCase() === update.email.toLowerCase(),
    );
    if (idx >= 0) {
      rels[idx] = { ...rels[idx], ...update, lastUpdated: new Date().toISOString() };
    } else {
      rels.push({ ...update, lastUpdated: new Date().toISOString() });
    }
  }
  // LRU eviction: keep the most recently updated
  const evictedRels = rels
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, REL_CAP);

  // --- Merge new memory entries (prepend newest, no dedup — extraction prompt
  //     is responsible for not re-emitting things already in memory) ---
  const newEntries: MemoryEntry[] = extraction.newMemories.map((e) => ({
    ...e,
    id: e.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: e.createdAt || new Date().toISOString(),
  }));
  const mergedEntries = [...newEntries, ...current.recentMemories].slice(0, ENTRY_CAP);

  return {
    relationships: evictedRels,
    recentMemories: mergedEntries,
    lastExtractedSessionId: sessionId,
  };
}

// ─── Compact serializer (injected as system message) ─────────────────────────
//
// Target: < 350 tokens. We take the 10 most-recent memories and up to 8
// relationships. Relationships appear first (structural context), then
// episodic memories (what happened).
//
// Format is intentionally dense / telegrammatic — the AI is smart enough
// to parse it, and tokens are more valuable than readability here.

export function serializeMemoryForPrompt(mem: UserMemory): string | null {
  const hasRels = mem.relationships.length > 0;
  const hasMems = mem.recentMemories.length > 0;
  if (!hasRels && !hasMems) return null;

  const lines: string[] = ["## Your persistent context (from past sessions)"];

  if (hasRels) {
    lines.push("\n### Key contacts");
    for (const r of mem.relationships.slice(0, 8)) {
      const notes = r.notes ? ` — ${r.notes}` : "";
      lines.push(`- ${r.name} <${r.email}> [${r.roleContext}]${notes}`);
    }
  }

  if (hasMems) {
    lines.push("\n### Recent facts & decisions");
    for (const e of mem.recentMemories.slice(0, 10)) {
      lines.push(`- ${e.content}`);
    }
  }

  lines.push(
    "\nUse this to give grounded, context-aware responses. " +
    "Do NOT mention this section to the user unless directly relevant.",
  );

  return lines.join("\n");
}
