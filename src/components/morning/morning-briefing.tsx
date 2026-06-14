"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow, getHours } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Check,
  Pencil,
  Trash2,
  ArrowRight,
  Clock,
  AlertTriangle,
  Inbox,
  Pin,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FOUNDER_CATEGORY_COLORS,
  FOUNDER_CATEGORY_LABELS,
  TRIAGE_LABELS,
  type FounderCategory,
  type TriageCategory,
  type DiracThread,
} from "@/lib/types";
import {
  loadPendingStore,
  savePendingBrief,
  removePendingThread,
  clearPendingBrief,
  mergeEnrichmentIntoSnapshot,
  hasValidBriefEnrichment,
  saveEnrichmentCache,
  type StoredPendingCard,
  type PendingBriefStore,
  type PendingPlanSnapshot,
  MORNING_BRIEF_PENDING_CHANGED,
} from "@/lib/morning-brief-pending";
import {
  notifyBlockingModalClosed,
  notifyBlockingModalOpened,
} from "@/lib/modal-blocking";

const MORNING_BRIEF_VERSION = "v2";
export const MORNING_BRIEF_SETTINGS_KEY = "dirac_morning_brief_settings";
const REVEAL_DELAY_MS = 1400;

export interface MorningPlanCard {
  threadId: string;
  platform: string;
  subject: string;
  sender: string;
  snippet: string;
  summary: string;
  aiSummary?: string;
  needsAction?: boolean;
  plan: string;           // heuristic fallback — shown only until AI plan arrives
  aiPlan?: string;        // AI-grounded specific plan — preferred when present
  planLoading?: boolean;  // true while the AI enrichment is in flight
  category?: FounderCategory;
  triage?: TriageCategory;
  urgent: boolean;
  commitmentCount: number;
  ageLabel: string;
}

export interface MorningBriefSettings {
  enabled: boolean;
  weekdaysOnly: boolean;
  morningOnly: boolean;
  maxItems: number;
}

const DEFAULT_SETTINGS: MorningBriefSettings = {
  enabled: true,
  weekdaysOnly: false,
  morningOnly: true,
  maxItems: 5,
};

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getMorningStorageKey() {
  return `dirac_morning_brief_seen_${MORNING_BRIEF_VERSION}_${todayKey()}`;
}

const BRIEF_DISMISSED_KEY = "dirac_brief_dismissed";

export function loadDismissedThreads(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BRIEF_DISMISSED_KEY) ?? "{}";
    const all = JSON.parse(raw) as Record<string, string>;
    const today = todayKey();
    // Prune expired entries while loading
    return Object.fromEntries(Object.entries(all).filter(([, until]) => until >= today));
  } catch {
    return {};
  }
}

export function suppressThread(threadId: string, days: number) {
  if (typeof window === "undefined") return;
  try {
    const all = loadDismissedThreads();
    const until = new Date();
    until.setDate(until.getDate() + days);
    all[threadId] = until.toISOString().slice(0, 10);
    window.localStorage.setItem(BRIEF_DISMISSED_KEY, JSON.stringify(all));
  } catch {}
}

// ── "Shown history" — soft suppression of threads we've already briefed ────
//
// The hard-dismissal above only fires when the user takes an explicit action
// (accept / open-with-ai / trash). That leaves a gap: if a thread shows up in
// Monday's briefing and the user just closes the modal, it would cheerfully
// reappear Tuesday, Wednesday, and so on — even if they've since read it in
// the inbox or decided to let it sit.
//
// The shown-history mechanism records *every* thread that appeared in a
// briefing. On subsequent mornings we filter it out unless:
//   1. genuinely new activity has arrived (lastMessageAt advanced), or
//   2. enough days have passed that it's worth re-checking anyway.
// A separate rule also handles "read since shown" — if the user has since
// marked the thread read and nothing new came in, we assume it's dealt with.

const BRIEF_SHOWN_KEY = "dirac_brief_shown";
const SHOWN_RETENTION_DAYS = 21;   // forget shown records after this long
export const SHOWN_RESTAGE_DAYS   = 4;    // re-surface anyway after this many days

export interface ShownRecord {
  shownAt: string;         // ISO — when this thread last appeared in a briefing
  shownMessageAt: string;  // ISO — the thread's lastMessageAt at that time
}

export function loadShownHistory(): Record<string, ShownRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BRIEF_SHOWN_KEY) ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, ShownRecord>;
    const cutoff = Date.now() - SHOWN_RETENTION_DAYS * 86_400_000;
    const kept: Record<string, ShownRecord> = {};
    for (const [id, rec] of Object.entries(parsed)) {
      if (!rec?.shownAt) continue;
      if (new Date(rec.shownAt).getTime() >= cutoff) kept[id] = rec;
    }
    return kept;
  } catch {
    return {};
  }
}

export function recordShownBriefing(
  plans: { threadId: string }[],
  threadsById: Map<string, DiracThread>,
) {
  if (typeof window === "undefined" || plans.length === 0) return;
  try {
    const all = loadShownHistory();
    const now = new Date().toISOString();
    for (const p of plans) {
      const t = threadsById.get(p.threadId);
      all[p.threadId] = {
        shownAt: now,
        shownMessageAt: t?.lastMessageAt ?? now,
      };
    }
    window.localStorage.setItem(BRIEF_SHOWN_KEY, JSON.stringify(all));
  } catch {}
}

/** Only explicit lifecycle actions remove a thread from the pending brief queue. */
export function isExcludedFromPendingBrief(
  threadId: string,
  dismissedThreads: Record<string, string>,
  doneThreads: Set<string>,
  snoozedThreads: { threadId: string }[],
): boolean {
  const today = todayKey();
  if (doneThreads.has(threadId)) return true;
  if (snoozedThreads.some((s) => s.threadId === threadId)) return true;
  const suppressedUntil = dismissedThreads[threadId];
  if (suppressedUntil && suppressedUntil >= today) return true;
  return false;
}

export function loadMorningSettings(): MorningBriefSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(MORNING_BRIEF_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<MorningBriefSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function buildSummary(thread: DiracThread, triage?: TriageCategory, commitmentCount = 0) {
  if (triage === "needs_reply") {
    return commitmentCount > 0
      ? `${thread.participants[0]?.name ?? "They"} need${commitmentCount > 1 ? "s" : ""} a reply — ${commitmentCount} open commitment${commitmentCount !== 1 ? "s" : ""} attached.`
      : `${thread.participants[0]?.name ?? "They"} sent this and it looks like it needs a reply.`;
  }
  if (triage === "waiting_on") {
    return `You're waiting on ${thread.participants[0]?.name ?? "them"} — no action needed yet.`;
  }
  if (thread.isUrgent) {
    return `Flagged urgent from ${thread.participants[0]?.name ?? "this sender"} — worth a quick read now.`;
  }
  // For low-signal FYI threads: return empty so the AI summary fills in, or the
  // card renders without a fallback summary rather than showing the raw snippet.
  return "";
}

export function buildPlan(thread: DiracThread, triage?: TriageCategory, category?: FounderCategory, commitmentCount = 0) {
  if (triage === "needs_reply") {
    if (category === "customer") return "Reply and close any open asks — keep it short.";
    if (category === "investor") return "Send a quick response — yes, no, or ask one clarifying question.";
    if (category === "outreach") return "Decide now: decline, ask one qualifying question, or archive.";
    if (commitmentCount > 0) return "Reply with clear ownership and close the loose commitments.";
    return "Draft a concise reply and either keep it active or close it out.";
  }
  if (triage === "waiting_on") return "No reply needed — nudge only if it's gone stale.";
  if (thread.isUrgent) return "Read it now and decide: respond immediately or explicitly defer.";
  return "Skim once and see if you need to save it.";
}

export function buildPlanCardFromThread(
  thread: DiracThread,
  triage: TriageCategory | undefined,
  category: FounderCategory | undefined,
  commitmentCount: number,
  enrichment?: Pick<StoredPendingCard, "aiSummary" | "aiPlan" | "needsAction">,
): MorningPlanCard {
  const base: MorningPlanCard = {
    threadId: thread.id,
    platform: thread.platform,
    subject: thread.subject,
    sender: thread.participants[0]?.name || thread.participants[0]?.email || "Unknown",
    snippet: thread.snippet ?? "",
    summary: buildSummary(thread, triage, commitmentCount),
    plan: buildPlan(thread, triage, category, commitmentCount),
    aiSummary: enrichment?.aiSummary,
    aiPlan: enrichment?.aiPlan,
    needsAction: enrichment?.needsAction,
    category,
    triage,
    urgent: thread.isUrgent,
    commitmentCount,
    ageLabel: formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true }),
  };
  const merged = mergeEnrichmentIntoSnapshot(thread.id, base);
  return {
    ...base,
    aiSummary: merged.aiSummary ?? base.aiSummary,
    aiPlan: merged.aiPlan ?? base.aiPlan,
    needsAction: merged.needsAction ?? base.needsAction,
  };
}

export function hydratePendingPlans(
  store: PendingBriefStore,
  threads: DiracThread[],
  triageMap: Record<string, TriageCategory>,
  categoryMap: Record<string, FounderCategory>,
  commitments: { threadId: string }[],
  doneThreads: Set<string>,
  snoozedThreads: { threadId: string }[],
  dismissedThreads: Record<string, string>,
): MorningPlanCard[] {
  const byId = new Map(threads.map((t) => [t.id, t]));
  const plans: MorningPlanCard[] = [];
  for (const stored of store.cards) {
    const thread = byId.get(stored.threadId);
    if (!thread) continue;
    const triage = triageMap[thread.id];
    const category = categoryMap[thread.id];
    if (
      isExcludedFromPendingBrief(
        thread.id,
        dismissedThreads,
        doneThreads,
        snoozedThreads,
      )
    ) {
      continue;
    }
    const commitmentCount = commitments.filter((c) => c.threadId === thread.id).length;
    const enrichment = mergeEnrichmentIntoSnapshot(stored.threadId, {
      threadId: stored.threadId,
      aiSummary: stored.aiSummary,
      aiPlan: stored.aiPlan,
      needsAction: stored.needsAction,
    });
    plans.push(
      buildPlanCardFromThread(thread, triage, category, commitmentCount, enrichment),
    );
  }
  return plans;
}

export function syncPendingStoreAfterHydrate(
  store: PendingBriefStore,
  hydrated: MorningPlanCard[],
  threads: DiracThread[],
  dismissedThreads: Record<string, string>,
  doneThreads: Set<string>,
  snoozedThreads: { threadId: string }[],
) {
  const hydratedById = new Map(hydrated.map((p) => [p.threadId, p]));
  const kept: PendingPlanSnapshot[] = [];

  for (const stored of store.cards) {
    if (
      isExcludedFromPendingBrief(
        stored.threadId,
        dismissedThreads,
        doneThreads,
        snoozedThreads,
      )
    ) {
      continue;
    }
    const thread = threads.find((t) => t.id === stored.threadId);
    if (!thread) {
      // Thread not in current fetch window (pagination gap) — preserve the
      // stored card so it survives re-opens. Only dealt-with threads (done /
      // snoozed / dismissed) are dropped, handled by isExcludedFromPendingBrief above.
      kept.push(stored);
      continue;
    }
    const h = hydratedById.get(stored.threadId);
    kept.push(
      mergeEnrichmentIntoSnapshot(stored.threadId, {
        threadId: stored.threadId,
        aiSummary: h?.aiSummary ?? stored.aiSummary,
        aiPlan: h?.aiPlan ?? stored.aiPlan,
        needsAction: h?.needsAction ?? stored.needsAction,
      }),
    );
  }

  if (kept.length === 0) {
    clearPendingBrief();
  } else {
    savePendingBrief(kept, { notify: false });
  }
}

export function resolveBriefPlansForOpen(
  hydratedPending: MorningPlanCard[],
  candidates: MorningPlanCard[],
): MorningPlanCard[] {
  const store = loadPendingStore();
  if (store && store.cards.length > 0) {
    return hydratedPending;
  }
  return candidates;
}

// ── Shimmer skeleton for a single plan card ────────────────────────────────

function SkeletonBar({ w, h = "h-3", opacity = "opacity-60" }: { w: string; h?: string; opacity?: string }) {
  return <div className={cn("rounded-md bg-muted", h, w, opacity)} />;
}

// ── Skeleton card ─────────────────────────────────────────────────────────

export function PlanCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
      className="relative rounded-lg border border-white/8 bg-black px-4 py-4 animate-pulse overflow-hidden"
    >
      {/* ghost pin */}
      <div className="absolute top-2.5 right-3 h-5 w-5 rounded-full bg-white/6" />
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <SkeletonBar w="w-52" h="h-4" />
        <SkeletonBar w="w-14" h="h-3.5" opacity="opacity-35" />
      </div>
      <SkeletonBar w="w-28" h="h-2.5" opacity="opacity-30" />
      <div className="mt-3 space-y-1.5">
        <SkeletonBar w="w-full" opacity="opacity-45" />
        <SkeletonBar w="w-4/5" opacity="opacity-35" />
        <div className="mt-2 pt-2 border-t border-white/6 space-y-1.5">
          <SkeletonBar w="w-full" opacity="opacity-40" />
          <SkeletonBar w="w-3/4" opacity="opacity-30" />
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <SkeletonBar w="w-20" h="h-6" opacity="opacity-45" />
        <SkeletonBar w="w-6" h="h-6" opacity="opacity-30" />
        <div className="ml-auto">
          <SkeletonBar w="w-16" h="h-4" opacity="opacity-20" />
        </div>
      </div>
    </motion.div>
  );
}

// ── Real plan card — dossier page aesthetic ────────────────────────────────

export function PlanCardContent({
  plan,
  index,
  isEditing,
  onEdit,
  onAccept,
  onOpenWithAi,
  onOpenThread,
  onDismiss,
  onPlanChange,
}: {
  plan: MorningPlanCard;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onAccept: () => void;
  onOpenWithAi: () => void;
  onOpenThread: () => void;
  onDismiss: () => void;
  onPlanChange: (val: string) => void;
}) {
  // Derive chip label: triage is more informative than bare "URGENT";
  // only fall back to URGENT when there's no triage status.
  const chipInfo = (() => {
    if (plan.triage === "needs_reply") {
      return {
        chipBg:    plan.urgent ? "bg-rose-500/20" : "bg-sky-500/15",
        chipText:  plan.urgent ? "text-rose-300"  : "text-sky-300",
        chipLabel: "REPLY NEEDED",
        pinClass:  plan.urgent ? "text-rose-400"  : "text-sky-400",
        cardBg:    "#000000",
        insetBg:   "#0a0a0a",
      };
    }
    if (plan.triage === "waiting_on") {
      return {
        chipBg:    plan.urgent ? "bg-rose-500/15" : "bg-indigo-500/15",
        chipText:  plan.urgent ? "text-rose-300"  : "text-indigo-300",
        chipLabel: "WAITING ON",
        pinClass:  plan.urgent ? "text-rose-400"  : "text-indigo-400",
        cardBg:    "#000000",
        insetBg:   "#0a0a0a",
      };
    }
    if (plan.urgent) {
      return {
        chipBg:    "bg-rose-500/20",
        chipText:  "text-rose-300",
        chipLabel: "URGENT",
        pinClass:  "text-rose-400",
        cardBg:    "#000000",
        insetBg:   "#0a0a0a",
      };
    }
    // Informational / FYI threads
    return {
      chipBg:    "",
      chipText:  "",
      chipLabel: plan.category === "customer"  ? "CUSTOMER"
               : plan.category === "investor"  ? "INVESTOR"
               : plan.category === "outreach"  ? "OUTREACH"
               : plan.commitmentCount > 0      ? "ACTION DUE"
               : null,
      pinClass:  "text-white/25",
      cardBg:    "#000000",
      insetBg:   "#0a0a0a",
    };
  })();

  const state = { ...chipInfo };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative rounded-lg border border-white/8 overflow-hidden"
      style={{ background: state.cardBg }}
    >
      {/* Pin — top-right, colored by state */}
      <div className="absolute top-2.5 right-3 z-10">
        <Pin
          className={cn("h-5 w-5 -rotate-45 drop-shadow", state.pinClass)}
          strokeWidth={2}
        />
      </div>

      <div className="px-4 pt-4 pb-3">
        {/* Row 1: triage chip + subject */}
        <div className="pr-7 space-y-1">
          {state.chipLabel && (
            <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.16em]", state.chipBg, state.chipText)}>
              {state.chipLabel}
            </span>
          )}
          <h3 className="text-[15px] font-medium leading-snug text-white/92 line-clamp-2">
            {plan.subject}
          </h3>
        </div>

        {/* Row 2: sender + age + dismiss */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] tracking-wide text-white/45 uppercase">
            {plan.sender}
            <span className="mx-1.5 text-white/20">·</span>
            {plan.ageLabel}
          </p>
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-white/18 transition-colors hover:text-rose-400/80"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Row 3: category + commitment chips (skip category if it's already the chipLabel) */}
        {(plan.category || plan.commitmentCount > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {plan.category && state.chipLabel !== plan.category?.toUpperCase() && (
              <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em]", FOUNDER_CATEGORY_COLORS[plan.category])}>
                {FOUNDER_CATEGORY_LABELS[plan.category].toUpperCase()}
              </span>
            )}
            {plan.commitmentCount > 0 && (
              <span className="rounded-sm bg-amber-400/12 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] text-amber-300/70">
                {plan.commitmentCount} COMMIT{plan.commitmentCount !== 1 ? "S" : ""}
              </span>
            )}
          </div>
        )}

        {/* Inset dossier block */}
        <div
          className="mt-3 rounded border border-white/6 px-3 py-2.5 space-y-2"
          style={{ background: state.insetBg }}
        >
          {/* Summary — AI when available, heuristic while loading / as fallback */}
          {(() => {
            const summaryText = plan.aiSummary?.trim() || (!plan.planLoading ? plan.summary : "");
            if (summaryText) {
              return (
                <p className="text-[12.5px] leading-[1.65] text-white/78">{summaryText}</p>
              );
            }
            if (plan.planLoading) {
              return (
                <div className="space-y-1.5 animate-pulse py-0.5">
                  <div className="h-2.5 w-full rounded bg-white/10" />
                  <div className="h-2.5 w-3/4 rounded bg-white/7" />
                </div>
              );
            }
            return null;
          })()}

          {/* Divider + plan — only show top border when there is content above */}
          <div className={cn("border-white/8", (plan.aiSummary?.trim() || plan.summary || plan.planLoading) ? "pt-2 border-t" : "")}>
            <p className="mb-1.5 font-mono text-[9px] tracking-[0.16em] text-white/28 uppercase">
              Recommended action
            </p>
            <div className="flex items-start justify-between gap-2">
              {plan.planLoading && !plan.aiPlan ? (
                <div className="flex-1 space-y-1.5 animate-pulse py-0.5">
                  <div className="h-2.5 w-5/6 rounded bg-white/10" />
                  <div className="h-2.5 w-2/3 rounded bg-white/7" />
                </div>
              ) : isEditing ? (
                <textarea
                  value={plan.aiPlan ?? plan.plan}
                  onChange={(e) => onPlanChange(e.target.value)}
                  className="flex-1 min-h-[72px] resize-none rounded border border-white/10 bg-white/5 px-2.5 py-2 font-mono text-[11.5px] leading-[1.6] text-white/80 outline-none focus:ring-1 focus:ring-orange-500/50"
                />
              ) : (
                <p className="flex-1 font-mono text-[11.5px] leading-[1.7] text-white/52 italic">
                  {plan.aiPlan ?? plan.plan}
                </p>
              )}
              <button
                onClick={onEdit}
                disabled={plan.planLoading && !plan.aiPlan}
                title={isEditing ? "Done" : "Edit plan"}
                className={cn(
                  "mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded transition-colors",
                  plan.planLoading && !plan.aiPlan
                    ? "text-white/12 cursor-not-allowed"
                    : isEditing
                      ? "text-orange-400"
                      : "text-white/22 hover:text-white/60"
                )}
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="mt-2.5 flex items-center gap-2">
          {plan.needsAction !== false && (
            <>
              <Button
                size="xs"
                onClick={onAccept}
              >
                <Check className="h-3 w-3" />
                {plan.triage === "needs_reply"
                  ? "Draft reply"
                  : plan.triage === "waiting_on"
                  ? "Check & nudge"
                  : plan.urgent
                  ? "Review now"
                  : "Start with AI"}
              </Button>
              <button
                onClick={onOpenWithAi}
                title="Open with AI"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:text-white/65 hover:bg-white/6"
              >
                <Sparkles className="h-3 w-3" />
              </button>
            </>
          )}
          <button
            onClick={onOpenThread}
            className={cn(
              "flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] text-white/28 uppercase transition-colors hover:text-white/55",
              plan.needsAction !== false ? "ml-auto" : "",
            )}
          >
            <ArrowRight className="h-3 w-3" />
            Open
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── computeBriefCandidates — extracted pure scoring function ───────────────

export interface ComputeBriefCandidatesArgs {
  threads: DiracThread[];
  triageMap: Record<string, TriageCategory>;
  categoryMap: Record<string, FounderCategory>;
  commitments: { threadId: string }[];
  doneThreads: Set<string>;
  snoozedThreads: { threadId: string }[];
  dismissedThreads: Record<string, string>;
  shownHistory: Record<string, ShownRecord>;
  pendingThreadIds: Set<string>;
  maxItems: number;
}

export function computeBriefCandidates({
  threads,
  triageMap,
  categoryMap,
  commitments,
  doneThreads,
  snoozedThreads,
  dismissedThreads,
  shownHistory,
  pendingThreadIds,
  maxItems,
}: ComputeBriefCandidatesArgs): MorningPlanCard[] {
  const today = todayKey();
  const nowMs = Date.now();
  const scored = threads
    .filter((thread) => {
      if (pendingThreadIds.has(thread.id)) return false;
      if (doneThreads.has(thread.id)) return false;
      if (snoozedThreads.some((s) => s.threadId === thread.id)) return false;
      const suppressedUntil = dismissedThreads[thread.id];
      if (suppressedUntil && suppressedUntil >= today) return false;

      const shown = shownHistory[thread.id];
      if (shown) {
        const shownAtMs = new Date(shown.shownAt).getTime();
        const shownMsgMs = shown.shownMessageAt
          ? new Date(shown.shownMessageAt).getTime()
          : 0;
        const threadMsgMs = new Date(thread.lastMessageAt).getTime();
        const hasNewActivity = threadMsgMs > shownMsgMs;
        const stale = (nowMs - shownAtMs) / 86_400_000 >= SHOWN_RESTAGE_DAYS;

        if (!hasNewActivity && !stale) return false;
        if (!hasNewActivity && !thread.isUnread) return false;
      }
      return true;
    })
    .map((thread) => {
      const triage = triageMap[thread.id];
      const category = categoryMap[thread.id];
      const commitmentCount = commitments.filter((c) => c.threadId === thread.id).length;

      const ageDays = (Date.now() - new Date(thread.lastMessageAt).getTime()) / 86_400_000;

      if (ageDays > 14 && !(thread.isUrgent && commitmentCount > 0)) return null;

      const agePenalty = ageDays > 10 ? 55 : ageDays > 5 ? 35 : ageDays > 2 ? 15 : 0;

      const score =
        (thread.isUrgent ? 100 : 0) +
        (triage === "needs_reply" ? 60 : 0) +
        (triage === "waiting_on" ? 25 : 0) +
        (category === "customer" ? 24 : 0) +
        (category === "investor" ? 20 : 0) +
        commitmentCount * 8 +
        (thread.isUnread ? 8 : 0) -
        agePenalty;

      return { thread, triage, category, commitmentCount, score, ageDays };
    })
    .filter((item): item is NonNullable<typeof item> => {
      if (!item) return false;
      if (item.category === "automated" && !item.thread.isUrgent && item.triage !== "needs_reply") return false;

      const wasShown = shownHistory[item.thread.id];
      if (!wasShown && !item.thread.isUnread) {
        const actionable =
          item.thread.isUrgent ||
          item.triage === "needs_reply" ||
          item.commitmentCount > 0;
        if (!actionable) return false;
      }

      return item.score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map(({ thread, triage, category, commitmentCount }) =>
      buildPlanCardFromThread(thread, triage, category, commitmentCount),
    );

  return scored;
}

// ── Main component ─────────────────────────────────────────────────────────

export function MorningBriefing() {
  const {
    threads,
    triageMap,
    categoryMap,
    commitments,
    doneThreads,
    snoozedThreads,
    threadsLoading,
    triageLoading,
    categoryLoading,
    setSelectedThreadId,
    setAiSidebarOpen,
    setPendingAiQuery,
    addToAiContext,
    clearAiContext,
  } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Notify the nav button whenever minimized state changes
  const setMinimizedWithEvent = (val: boolean) => {
    setMinimized(val);
    window.dispatchEvent(
      new CustomEvent("dirac:morning-brief-minimized", { detail: { minimized: val } }),
    );
  };
  const [revealed, setRevealed] = useState(false);
  const [plans, setPlans] = useState<MorningPlanCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MorningBriefSettings>(DEFAULT_SETTINGS);
  const [dismissedThreads, setDismissedThreads] = useState<Record<string, string>>({});
  const [shownHistory, setShownHistory] = useState<Record<string, ShownRecord>>({});
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextShimmer = useRef(false);
  const hasAutoOpened = useRef<string | null>(null); // stores the date shown, handles overnight tabs
  const enrichAbort = useRef<AbortController | null>(null);
  const [pendingRevision, setPendingRevision] = useState(0);

  useEffect(() => {
    const onPendingChanged = () => setPendingRevision((n) => n + 1);
    window.addEventListener(MORNING_BRIEF_PENDING_CHANGED, onPendingChanged);
    return () =>
      window.removeEventListener(MORNING_BRIEF_PENDING_CHANGED, onPendingChanged);
  }, []);

  const pendingThreadIds = useMemo(() => {
    const store = loadPendingStore();
    return new Set(store?.cards.map((c) => c.threadId) ?? []);
  }, [dismissedThreads, plans.length, pendingRevision]);

  const hydratedPending = useMemo(() => {
    const store = loadPendingStore();
    if (!store) return [];
    return hydratePendingPlans(
      store,
      threads,
      triageMap,
      categoryMap,
      commitments,
      doneThreads,
      snoozedThreads,
      dismissedThreads,
    );
  }, [
    threads,
    triageMap,
    categoryMap,
    commitments,
    doneThreads,
    snoozedThreads,
    dismissedThreads,
    pendingThreadIds,
  ]);

  const candidates = useMemo(
    () =>
      computeBriefCandidates({
        threads,
        triageMap,
        categoryMap,
        commitments,
        doneThreads,
        snoozedThreads,
        dismissedThreads,
        shownHistory,
        pendingThreadIds,
        maxItems: settings.maxItems,
      }),
    [
      threads,
      triageMap,
      categoryMap,
      commitments,
      doneThreads,
      snoozedThreads,
      settings.maxItems,
      dismissedThreads,
      shownHistory,
      pendingThreadIds,
    ],
  );

  useEffect(() => {
    setSettings(loadMorningSettings());
    setDismissedThreads(loadDismissedThreads());
    setShownHistory(loadShownHistory());
  }, []);

  // Trigger reveal animation when dialog opens
  useEffect(() => {
    if (open) {
      if (skipNextShimmer.current) {
        skipNextShimmer.current = false;
        setRevealed(true);
      } else {
        setRevealed(false);
        revealTimer.current = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
      }
    } else {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    }
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [open]);

  // Cards still missing AI copy (not in localStorage cache).
  const enrichmentKey = useMemo(
    () =>
      plans
        .map((p) => `${p.threadId}:${hasValidBriefEnrichment(p) ? "1" : "0"}`)
        .join("|"),
    [plans],
  );

  // ─── AI enrichment: only for cards without cached summary + plan ─────────
  useEffect(() => {
    if (!open) {
      enrichAbort.current?.abort();
      return;
    }
    if (plans.length === 0) return;

    const needsEnrichment = plans.filter((p) => !hasValidBriefEnrichment(p));
    if (needsEnrichment.length === 0) return;

    const controller = new AbortController();
    enrichAbort.current = controller;

    const snapshot = needsEnrichment.map((p) => ({
      threadId: p.threadId,
      platform: p.platform,
      subject: p.subject,
      sender: p.sender,
      snippet: p.snippet,
      triage: p.triage,
      category: p.category,
      isUrgent: p.urgent,
      commitmentCount: p.commitmentCount,
      ageLabel: p.ageLabel,
    }));

    setPlans((prev) =>
      prev.map((p) =>
        hasValidBriefEnrichment(p) ? p : { ...p, planLoading: true },
      ),
    );

    (async () => {
      try {
        const res = await fetch("/api/ai/morning-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards: snapshot }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setPlans((prev) => prev.map((p) => ({ ...p, planLoading: false })));
          return;
        }
        const data = await res.json();
        if (!data.cards) {
          setPlans((prev) => prev.map((p) => ({ ...p, planLoading: false })));
          return;
        }
        const aiById = new Map(
          (
            data.cards as {
              threadId: string;
              summary: string;
              needsAction: boolean;
              plan?: string;
            }[]
          ).map((c) => [c.threadId, c]),
        );

        setPlans((prev) => {
          const next = prev.map((p) => {
            const ai = aiById.get(p.threadId);
            if (!ai) return { ...p, planLoading: false };
            const aiPlan = ai.plan?.trim() || p.aiPlan || p.plan;
            const aiSummary = ai.summary?.trim() || p.aiSummary;
            if (!aiSummary?.trim() || !aiPlan?.trim()) {
              return { ...p, planLoading: false };
            }
            return {
              ...p,
              aiSummary,
              needsAction: ai.needsAction,
              aiPlan,
              planLoading: false,
            };
          });
          saveEnrichmentCache(next);
          savePendingBrief(next, { notify: false });
          return next;
        });
      } catch {
        setPlans((prev) => prev.map((p) => ({ ...p, planLoading: false })));
      }
    })();

    return () => controller.abort();
  }, [open, enrichmentKey, plans.length]);

  // Keep pending queue + enrichment cache in sync with visible cards.
  useEffect(() => {
    if (plans.length === 0) return;
    saveEnrichmentCache(plans);
    savePendingBrief(plans, { notify: false });
  }, [plans]);

  // Prune/sync localStorage when hydrated pending changes (silent — no notify).
  useEffect(() => {
    const store = loadPendingStore();
    if (!store?.cards.length) return;
    syncPendingStoreAfterHydrate(
      store,
      hydratedPending,
      threads,
      dismissedThreads,
      doneThreads,
      snoozedThreads,
    );
  }, [hydratedPending, threads, dismissedThreads, doneThreads, snoozedThreads]);

  // Refresh visible cards when inbox catches up (e.g. after manual add).
  useEffect(() => {
    if (!open && !minimized) return;
    if (hydratedPending.length === 0) return;
    setPlans((prev) => {
      const prevIds = prev
        .map((p) => p.threadId)
        .sort()
        .join(",");
      const nextIds = hydratedPending
        .map((p) => p.threadId)
        .sort()
        .join(",");
      return prevIds === nextIds ? prev : hydratedPending;
    });
  }, [open, minimized, hydratedPending]);

  const openBriefSession = useCallback(
    (opts?: { recordShownForNew?: boolean }) => {
      const store = loadPendingStore();
      const pending = store
        ? hydratePendingPlans(
            store,
            threads,
            triageMap,
            categoryMap,
            commitments,
            doneThreads,
            snoozedThreads,
            dismissedThreads,
          )
        : [];

      if (store && store.cards.length > 0) {
        syncPendingStoreAfterHydrate(
          store,
          pending,
          threads,
          dismissedThreads,
          doneThreads,
          snoozedThreads,
        );
      }

      const toShow = resolveBriefPlansForOpen(pending, candidates);

      if (!store?.cards.length && candidates.length > 0) {
        savePendingBrief(candidates);
        if (opts?.recordShownForNew) {
          const byId = new Map(threads.map((t) => [t.id, t]));
          recordShownBriefing(candidates, byId);
          setShownHistory(loadShownHistory());
        }
      }

      setPlans(toShow);
      setOpen(true);
    },
    [
      threads,
      triageMap,
      categoryMap,
      commitments,
      doneThreads,
      snoozedThreads,
      dismissedThreads,
      candidates,
    ],
  );

  useEffect(() => {
    function handleOpen() {
      openBriefSession({ recordShownForNew: true });
    }
    function handleReopen() {
      // Re-open from the minimized state via the nav button
      skipNextShimmer.current = true;
      setMinimizedWithEvent(false);
      setOpen(true);
    }
    function handleStorage() {
      setSettings(loadMorningSettings());
    }
    window.addEventListener("dirac:open-morning-briefing", handleOpen);
    window.addEventListener("dirac:reopen-morning-briefing", handleReopen);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("dirac:open-morning-briefing", handleOpen);
      window.removeEventListener("dirac:reopen-morning-briefing", handleReopen);
      window.removeEventListener("storage", handleStorage);
    };
  }, [openBriefSession]);

  useEffect(() => {
    if (open) notifyBlockingModalOpened("morning-briefing");
    else notifyBlockingModalClosed("morning-briefing");
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/inbox") return;
    if (!settings.enabled) return;
    if (threadsLoading || triageLoading || categoryLoading) return;
    if (threads.length === 0) return;

    // First inbox landing after signup: let shortcuts + tour finish before auto-open.
    const FIRST_LAND_KEY = "dirac_inbox_first_land";
    if (!window.localStorage.getItem(FIRST_LAND_KEY)) {
      window.localStorage.setItem(FIRST_LAND_KEY, "1");
      return;
    }

    const now = new Date();
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    const isMorning = getHours(now) < 12;

    const today = todayKey();
    if (settings.weekdaysOnly && !isWeekday) return;
    if (settings.morningOnly && !isMorning) return;

    // Already shown today in this JS session (including overnight-open tabs — date mismatch = new day)
    if (hasAutoOpened.current === today) return;

    // Already shown today in a previous session or tab
    const seen = window.localStorage.getItem(getMorningStorageKey());
    if (seen) return;

    const hasPending = (loadPendingStore()?.cards.length ?? 0) > 0;
    if (!hasPending && candidates.length === 0) return;

    hasAutoOpened.current = today;
    window.localStorage.setItem(getMorningStorageKey(), "1");
    // Navigate to the dedicated brief page instead of opening the dialog.
    // The seen key is already written above, so this fires at most once per day
    // and never loops (the effect is gated to pathname === "/inbox").
    router.push("/brief");
  }, [
    pathname,
    settings,
    threadsLoading,
    triageLoading,
    categoryLoading,
    threads.length,
    candidates.length,
    router,
  ]);

  const minimize = () => {
    setOpen(false);
    setMinimizedWithEvent(true);
  };

  const reopenFromMinimized = () => {
    skipNextShimmer.current = true;
    setMinimizedWithEvent(false);
    setOpen(true);
  };

  const refreshDismissed = () => setDismissedThreads(loadDismissedThreads());

  // Detect whether a plan is asking for a NEW outbound email versus a reply
  // to the in-context thread. The AI's system prompt distinguishes "compose"
  // from "draft" but doesn't otherwise know which mode the plan implies, so
  // we feed it a one-line hint based on the plan verbs.
  const detectPlanIntent = (planText: string): "compose" | "draft" | "neutral" => {
    const t = planText.toLowerCase();
    // "Reply", "respond to them", "follow up on this thread" → existing thread
    if (/\b(reply|respond|follow[\s-]?up on|answer|acknowledge)\b/.test(t)) return "draft";
    // "Email X", "send to Y", "reach out to Z", "introduce", "write to" → new
    if (/\b(email|message|write to|reach out|introduce|loop in|cc|forward to|send (an? )?(email|note|message) to)\b/.test(t)) return "compose";
    return "neutral";
  };

  const intentHint = (intent: "compose" | "draft" | "neutral") => {
    if (intent === "compose") return "\n\nNote: this plan calls for a NEW outbound email — produce a `compose` block, not a reply draft. Resolve the recipient from the contact directory.";
    if (intent === "draft") return "\n\nNote: this plan is a reply to the thread above — produce a `draft` block addressed to the existing participants.";
    return "";
  };

  const acceptPlan = (plan: MorningPlanCard) => {
    const effectivePlan = plan.aiPlan ?? plan.plan;
    suppressThread(plan.threadId, 2); // acted on — rest for 2 days
    removePendingThread(plan.threadId);
    refreshDismissed();
    // Scope AI context to just this thread so the agent knows exactly which
    // email the plan is for — any previously-pinned threads are cleared.
    clearAiContext();
    addToAiContext({ id: plan.threadId, label: plan.subject });
    const hint = intentHint(detectPlanIntent(effectivePlan));
    setPendingAiQuery(
      `From this morning's briefing — thread "${plan.subject}" (${plan.sender}). Plan: ${effectivePlan}${hint}`,
    );
    setAiSidebarOpen(true);
    setSelectedThreadId(plan.threadId);
    minimize();
  };

  const openWithAi = (plan: MorningPlanCard) => {
    const effectivePlan = plan.aiPlan ?? plan.plan;
    suppressThread(plan.threadId, 2);
    removePendingThread(plan.threadId);
    refreshDismissed();
    clearAiContext();
    addToAiContext({ id: plan.threadId, label: plan.subject });
    const hint = intentHint(detectPlanIntent(effectivePlan));
    setPendingAiQuery(
      `Help me execute this plan for "${plan.subject}" from ${plan.sender}: ${effectivePlan}${hint}`,
    );
    setAiSidebarOpen(true);
    setSelectedThreadId(plan.threadId);
    minimize();
  };

  const dismissPlan = (threadId: string) => {
    suppressThread(threadId, 3); // explicit dismiss — skip for 3 days
    removePendingThread(threadId);
    refreshDismissed();
    setPlans((prev) => prev.filter((p) => p.threadId !== threadId));
  };

  const closeForToday = () => {
    // localStorage key already written when modal opened — just close
    setMinimizedWithEvent(false);
    setOpen(false);
  };

  const skeletonCount = Math.min(plans.length || 3, settings.maxItems);
  const briefTime = format(new Date(), "h:mm a").toUpperCase();

  // Inline SVG grain data URL — subtle paper noise
  const grainBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) minimize(); }}>
        <DialogContent
          className="morning-brief-dialog max-w-3xl gap-0 overflow-hidden p-0 border-white/10"
          showCloseButton={false}
        >
          {/* Paper grain texture overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{ backgroundImage: grainBg, opacity: 0.035 }}
          />

          {/* Header */}
          <DialogHeader className="relative z-10 border-b border-white/8 px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle asChild>
                  <h2
                    className="text-[23px] text-white/92 leading-none tracking-tight"
                    style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
                  >
                    Morning Brief
                  </h2>
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="mt-1.5 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase select-none">
                    Brief · {briefTime} · {plans.length || skeletonCount} Emails
                  </p>
                </DialogDescription>
              </div>
              <button
                onClick={closeForToday}
                className="mt-0.5 font-mono text-[10px] tracking-[0.12em] uppercase text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                Dismiss
              </button>
            </div>
          </DialogHeader>

          {/* Card grid */}
          <div className="relative z-10 max-h-[68vh] overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2.5">
              <AnimatePresence mode="wait">
                {!revealed ? (
                  <motion.div
                    key="skeletons"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-2.5"
                  >
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                      <PlanCardSkeleton key={i} index={i} />
                    ))}
                  </motion.div>
                ) : plans.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center rounded-lg border border-white/8 px-6 py-14 text-center"
                  >
                    <Inbox className="mb-3 h-8 w-8 text-white/15" />
                    <p
                      className="text-[16px] text-white/70"
                      style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
                    >
                      Inbox clear
                    </p>
                    <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-white/25">
                      Nothing outstanding today
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="cards"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-2.5"
                  >
                    <AnimatePresence>
                      {plans.map((plan, idx) => {
                        const isEditing = editingId === plan.threadId;
                        return (
                          <PlanCardContent
                            key={plan.threadId}
                            plan={plan}
                            index={idx}
                            isEditing={isEditing}
                            onEdit={() => setEditingId(isEditing ? null : plan.threadId)}
                            onAccept={() => acceptPlan(plan)}
                            onOpenWithAi={() => openWithAi(plan)}
                            onOpenThread={() => { setSelectedThreadId(plan.threadId); minimize(); }}
                            onDismiss={() => dismissPlan(plan.threadId)}
                            onPlanChange={(val) =>
                              setPlans((prev) => prev.map((p) => {
                                if (p.threadId !== plan.threadId) return p;
                                return p.aiPlan !== undefined
                                  ? { ...p, aiPlan: val }
                                  : { ...p, plan: val };
                              }))
                            }
                          />
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/8 px-6 py-3 font-mono text-[9px] tracking-[0.14em] uppercase text-white/20">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Once per day · optional
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Plans are editable
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Minimized state is shown via the nav Sunrise button (see app-nav.tsx) */}
    </>
  );
}
