/** Client-side queue of threads pinned to the Morning Brief until dealt with. */

export const BRIEF_PENDING_KEY = "dirac_brief_pending";
const BRIEF_ENRICHMENT_CACHE_KEY = "dirac_morning_brief_enrichment";
const BRIEF_DISMISSED_KEY = "dirac_brief_dismissed";

export interface BriefEnrichmentCache {
  aiSummary: string;
  aiPlan: string;
  needsAction?: boolean;
  cachedAt: string;
}

export type BriefEnrichmentCacheMap = Record<string, BriefEnrichmentCache>;

export const MORNING_BRIEF_PENDING_CHANGED = "dirac:morning-brief-pending-changed";

export interface StoredPendingCard {
  threadId: string;
  aiSummary?: string;
  aiPlan?: string;
  needsAction?: boolean;
}

export interface PendingBriefStore {
  cards: StoredPendingCard[];
  savedAt: string;
}

export interface PendingPlanSnapshot {
  threadId: string;
  aiSummary?: string;
  aiPlan?: string;
  needsAction?: boolean;
}

export function hasValidBriefEnrichment(
  card: Pick<PendingPlanSnapshot, "aiSummary" | "aiPlan">,
): boolean {
  return Boolean(card.aiSummary?.trim() && card.aiPlan?.trim());
}

export function loadEnrichmentCache(): BriefEnrichmentCacheMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BRIEF_ENRICHMENT_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BriefEnrichmentCacheMap;
  } catch {
    return {};
  }
}

export function getCachedEnrichment(
  threadId: string,
): BriefEnrichmentCache | null {
  const entry = loadEnrichmentCache()[threadId];
  if (!entry?.aiSummary?.trim() || !entry?.aiPlan?.trim()) return null;
  return entry;
}

export function saveEnrichmentCache(entries: PendingPlanSnapshot[]) {
  if (typeof window === "undefined" || entries.length === 0) return;
  try {
    const cache = loadEnrichmentCache();
    const now = new Date().toISOString();
    let changed = false;
    for (const e of entries) {
      if (!hasValidBriefEnrichment(e)) continue;
      cache[e.threadId] = {
        aiSummary: e.aiSummary!.trim(),
        aiPlan: e.aiPlan!.trim(),
        needsAction: e.needsAction,
        cachedAt: now,
      };
      changed = true;
    }
    if (changed) {
      window.localStorage.setItem(BRIEF_ENRICHMENT_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {}
}

function notifyPendingChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MORNING_BRIEF_PENDING_CHANGED));
}

function clearBriefDismissals(threadIds: string[]) {
  if (typeof window === "undefined" || threadIds.length === 0) return;
  try {
    const raw = window.localStorage.getItem(BRIEF_DISMISSED_KEY) ?? "{}";
    const all = JSON.parse(raw) as Record<string, string>;
    let changed = false;
    for (const id of threadIds) {
      if (id in all) {
        delete all[id];
        changed = true;
      }
    }
    if (changed) {
      window.localStorage.setItem(BRIEF_DISMISSED_KEY, JSON.stringify(all));
    }
  } catch {}
}

export function loadPendingStore(): PendingBriefStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRIEF_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBriefStore;
    if (!Array.isArray(parsed?.cards) || parsed.cards.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getPendingThreadIds(): Set<string> {
  const store = loadPendingStore();
  return new Set(store?.cards.map((c) => c.threadId) ?? []);
}

export function isInMorningBriefPending(threadId: string): boolean {
  return getPendingThreadIds().has(threadId);
}

function pendingCardsEqual(
  a: StoredPendingCard[],
  b: StoredPendingCard[],
): boolean {
  if (a.length !== b.length) return false;
  const sortById = (cards: StoredPendingCard[]) =>
    [...cards].sort((x, y) => x.threadId.localeCompare(y.threadId));
  const left = sortById(a);
  const right = sortById(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i].threadId !== right[i].threadId) return false;
    if (left[i].aiSummary !== right[i].aiSummary) return false;
    if (left[i].aiPlan !== right[i].aiPlan) return false;
    if (left[i].needsAction !== right[i].needsAction) return false;
  }
  return true;
}

export function savePendingBrief(
  plans: PendingPlanSnapshot[],
  options?: { notify?: boolean },
) {
  if (typeof window === "undefined" || plans.length === 0) return;
  try {
    const cards: StoredPendingCard[] = plans.map((p) => ({
      threadId: p.threadId,
      aiSummary: p.aiSummary,
      aiPlan: p.aiPlan,
      needsAction: p.needsAction,
    }));
    const existing = loadPendingStore();
    if (existing && pendingCardsEqual(existing.cards, cards)) return;

    const store: PendingBriefStore = {
      savedAt: new Date().toISOString(),
      cards,
    };
    window.localStorage.setItem(BRIEF_PENDING_KEY, JSON.stringify(store));
    saveEnrichmentCache(cards);
    if (options?.notify !== false) notifyPendingChanged();
  } catch {}
}

/** Drop done/snoozed/dismissed/missing threads from storage without wiping the whole queue. */
export function prunePendingBrief(validThreadIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    const store = loadPendingStore();
    if (!store) return;
    const keep = new Set(validThreadIds);
    const cards = store.cards.filter((c) => keep.has(c.threadId));
    if (pendingCardsEqual(store.cards, cards)) return;
    if (cards.length === 0) {
      window.localStorage.removeItem(BRIEF_PENDING_KEY);
    } else {
      window.localStorage.setItem(
        BRIEF_PENDING_KEY,
        JSON.stringify({ ...store, cards, savedAt: new Date().toISOString() }),
      );
    }
    notifyPendingChanged();
  } catch {}
}

/** Append threads to the morning brief queue (manual add from inbox). */
export function addThreadsToMorningBrief(threadIds: string[]): {
  added: number;
  skipped: number;
} {
  if (typeof window === "undefined") return { added: 0, skipped: 0 };

  const unique = [...new Set(threadIds.filter(Boolean))];
  if (unique.length === 0) return { added: 0, skipped: 0 };

  try {
    const existing = loadPendingStore();
    const cards = [...(existing?.cards ?? [])];
    const ids = new Set(cards.map((c) => c.threadId));
    const toAdd: string[] = [];

    for (const id of unique) {
      if (ids.has(id)) continue;
      cards.push({ threadId: id });
      ids.add(id);
      toAdd.push(id);
    }

    const skipped = unique.length - toAdd.length;
    if (toAdd.length === 0) return { added: 0, skipped };

    clearBriefDismissals(toAdd);

    const store: PendingBriefStore = {
      savedAt: new Date().toISOString(),
      cards,
    };
    window.localStorage.setItem(BRIEF_PENDING_KEY, JSON.stringify(store));
    notifyPendingChanged();
    return { added: toAdd.length, skipped };
  } catch {
    return { added: 0, skipped: unique.length };
  }
}

export function mergeEnrichmentIntoSnapshot(
  threadId: string,
  snapshot: PendingPlanSnapshot,
): PendingPlanSnapshot {
  const cached = getCachedEnrichment(threadId);
  if (!cached) return snapshot;
  return {
    ...snapshot,
    aiSummary: snapshot.aiSummary?.trim() || cached.aiSummary,
    aiPlan: snapshot.aiPlan?.trim() || cached.aiPlan,
    needsAction: snapshot.needsAction ?? cached.needsAction,
  };
}

export function removePendingThread(threadId: string) {
  if (typeof window === "undefined") return;
  try {
    const store = loadPendingStore();
    if (!store) return;
    const cards = store.cards.filter((c) => c.threadId !== threadId);
    if (cards.length === 0) {
      window.localStorage.removeItem(BRIEF_PENDING_KEY);
    } else {
      window.localStorage.setItem(
        BRIEF_PENDING_KEY,
        JSON.stringify({ ...store, cards }),
      );
    }
    notifyPendingChanged();
  } catch {}
}

export function clearPendingBrief() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BRIEF_PENDING_KEY);
    notifyPendingChanged();
  } catch {}
}
