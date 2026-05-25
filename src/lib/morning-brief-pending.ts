/** Persisted morning-brief queue — survives closes until dismissed or dealt with. */

export const BRIEF_PENDING_KEY = "dirac_brief_pending";

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

export interface MorningPlanPersisted {
  threadId: string;
  aiSummary?: string;
  aiPlan?: string;
  needsAction?: boolean;
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

export function savePendingBrief(plans: MorningPlanPersisted[]) {
  if (typeof window === "undefined" || plans.length === 0) return;
  try {
    const store: PendingBriefStore = {
      savedAt: new Date().toISOString(),
      cards: plans.map((p) => ({
        threadId: p.threadId,
        aiSummary: p.aiSummary,
        aiPlan: p.aiPlan,
        needsAction: p.needsAction,
      })),
    };
    window.localStorage.setItem(BRIEF_PENDING_KEY, JSON.stringify(store));
    notifyPendingChanged();
  } catch {}
}

/** Append threads to the pending brief. Returns count newly added. */
export function addThreadsToMorningBrief(threadIds: string[]): number {
  if (typeof window === "undefined" || threadIds.length === 0) return 0;
  try {
    const unique = [...new Set(threadIds)];
    const store = loadPendingStore() ?? {
      cards: [],
      savedAt: new Date().toISOString(),
    };
    const existing = new Set(store.cards.map((c) => c.threadId));
    let added = 0;
    for (const id of unique) {
      if (existing.has(id)) continue;
      store.cards.push({ threadId: id });
      existing.add(id);
      added++;
    }
    if (added === 0) return 0;
    store.savedAt = new Date().toISOString();
    window.localStorage.setItem(BRIEF_PENDING_KEY, JSON.stringify(store));
    notifyPendingChanged();
    return added;
  } catch {
    return 0;
  }
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

export function notifyPendingChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dirac:morning-brief-pending-changed"));
}
