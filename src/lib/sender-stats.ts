/**
 * Client-side sender history cache.
 *
 * All data lives exclusively in localStorage — no sender metadata is ever
 * uploaded to Dirac servers, preserving user privacy.
 *
 * Two mechanisms keep the cache accurate:
 *  1. Passive accumulation — every time threads load in the app, we merge
 *     participant dates into the cache at zero extra API cost.
 *  2. One-time historical backfill — on the user's first visit to /senders,
 *     we paginate through more inbox history (up to BACKFILL_PAGES pages) in
 *     the background and merge the result.
 */

import type { DiracThread } from "@/lib/types";

// ── Storage keys ──────────────────────────────────────────────────────────────

const STATS_KEY         = "dirac:sender_stats_v1";
const BACKFILL_DONE_KEY = "dirac:sender_stats_backfill_done";
const UPDATED_AT_KEY    = "dirac:sender_stats_updated_at";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SenderStat {
  name: string;
  firstSeenAt: string; // ISO string — earliest interaction date
  lastSeenAt: string;  // ISO string — most recent interaction date
}

export type SenderStatsMap = Record<string, SenderStat>; // keyed by lowercase email

// ── Read / write helpers ──────────────────────────────────────────────────────

export function loadSenderStatsMap(): SenderStatsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? (JSON.parse(raw) as SenderStatsMap) : {};
  } catch {
    return {};
  }
}

function saveSenderStatsMap(map: SenderStatsMap): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(map));
    localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

export function getSenderStatsUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(UPDATED_AT_KEY);
}

export function isSenderBackfillDone(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BACKFILL_DONE_KEY) === "true";
}

export function markSenderBackfillDone(): void {
  try {
    localStorage.setItem(BACKFILL_DONE_KEY, "true");
  } catch {
    // ignore
  }
}

// ── Core merge logic ──────────────────────────────────────────────────────────

/**
 * Merge an array of DiracThreads into the cached sender stats.
 * Preserves the earliest firstSeenAt and latest lastSeenAt seen across all
 * calls, so the picture only ever grows more accurate over time.
 *
 * Returns true if any entry was updated (useful for triggering re-renders).
 */
export function mergeSenderStatsFromThreads(threads: DiracThread[]): boolean {
  if (threads.length === 0) return false;

  const map = loadSenderStatsMap();
  let changed = false;

  for (const thread of threads) {
    // Use firstMessageAt (true thread start) when available; fall back to lastMessageAt
    const threadFirst = thread.firstMessageAt ?? thread.lastMessageAt;
    const threadLast  = thread.lastMessageAt;

    for (const p of thread.participants) {
      if (!p.email) continue;
      const addr = p.email.toLowerCase();
      const name = p.name || addr;

      const existing = map[addr];
      if (existing) {
        let updated = false;
        if (threadFirst < existing.firstSeenAt) {
          existing.firstSeenAt = threadFirst;
          updated = true;
        }
        if (threadLast > existing.lastSeenAt) {
          existing.lastSeenAt = threadLast;
          updated = true;
        }
        // Keep the more descriptive name
        if (!existing.name || existing.name === addr) {
          existing.name = name;
          updated = true;
        }
        if (updated) changed = true;
      } else {
        map[addr] = { name, firstSeenAt: threadFirst, lastSeenAt: threadLast };
        changed = true;
      }
    }
  }

  if (changed) saveSenderStatsMap(map);
  return changed;
}
