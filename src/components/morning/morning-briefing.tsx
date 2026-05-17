"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow, getHours } from "date-fns";
import { usePathname } from "next/navigation";
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

const MORNING_BRIEF_VERSION = "v2";
const MORNING_BRIEF_SETTINGS_KEY = "dirac_morning_brief_settings";
const REVEAL_DELAY_MS = 1400;

interface MorningPlanCard {
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

interface MorningBriefSettings {
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

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getMorningStorageKey() {
  return `dirac_morning_brief_seen_${MORNING_BRIEF_VERSION}_${todayKey()}`;
}

const BRIEF_DISMISSED_KEY = "dirac_brief_dismissed";

function loadDismissedThreads(): Record<string, string> {
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

function suppressThread(threadId: string, days: number) {
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
const SHOWN_RESTAGE_DAYS   = 4;    // re-surface anyway after this many days

interface ShownRecord {
  shownAt: string;         // ISO — when this thread last appeared in a briefing
  shownMessageAt: string;  // ISO — the thread's lastMessageAt at that time
}

function loadShownHistory(): Record<string, ShownRecord> {
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

function recordShownBriefing(
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

function loadMorningSettings(): MorningBriefSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(MORNING_BRIEF_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<MorningBriefSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildSummary(thread: DiracThread, triage?: TriageCategory, commitmentCount = 0) {
  if (triage === "needs_reply") {
    return commitmentCount > 0
      ? `Needs your response and has ${commitmentCount} active commitment${commitmentCount !== 1 ? "s" : ""}.`
      : "Looks like active work that probably needs your reply.";
  }
  if (triage === "waiting_on") {
    return "Currently blocked on them replying, so this is more tracking than action.";
  }
  if (thread.isUrgent) {
    return "This thread is flagged as urgent and should be reviewed early.";
  }
  return thread.snippet?.trim()
    ? thread.snippet.slice(0, 120) + (thread.snippet.length > 120 ? "…" : "")
    : "Likely low-touch or informational.";
}

function buildPlan(thread: DiracThread, triage?: TriageCategory, category?: FounderCategory, commitmentCount = 0) {
  if (triage === "needs_reply") {
    if (category === "customer") return "Draft a short, reassuring reply and clear the open asks.";
    if (category === "investor") return "Send a concise response and clarify whether this needs a meeting or a pass.";
    if (category === "outreach") return "Decide quickly: decline, ask one qualifying question, or archive.";
    if (commitmentCount > 0) return "Reply with clear ownership and close any loose commitments.";
    return "Draft a concise reply, then decide whether to keep it active or mark it done.";
  }
  if (triage === "waiting_on") return "Leave this in tracking mode and only nudge if it has gone stale.";
  if (thread.isUrgent) return "Review first, decide whether to respond now or explicitly defer it.";
  return "Skim once, then archive, mark done, or leave for later if it still matters.";
}

// ── Shimmer skeleton for a single plan card ────────────────────────────────

function SkeletonBar({ w, h = "h-3", opacity = "opacity-60" }: { w: string; h?: string; opacity?: string }) {
  return <div className={cn("rounded-md bg-muted", h, w, opacity)} />;
}

// ── Skeleton card ─────────────────────────────────────────────────────────

function PlanCardSkeleton({ index }: { index: number }) {
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

function PlanCardContent({
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
          <h3
            className="text-[15px] leading-snug text-white/92 line-clamp-2"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
          >
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
          {/* Summary — primary reading content, high-ish contrast */}
          {plan.aiSummary ? (
            <p className="text-[12.5px] leading-[1.65] text-white/78">{plan.aiSummary}</p>
          ) : (
            <div className="space-y-1.5 animate-pulse py-0.5">
              <div className="h-2.5 w-full rounded bg-white/10" />
              <div className="h-2.5 w-3/4 rounded bg-white/7" />
            </div>
          )}

          {/* Divider + plan */}
          <div className="pt-2 border-t border-white/8">
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
              <button
                onClick={onAccept}
                className="flex h-7 items-center gap-1.5 rounded px-3 text-[11px] font-semibold tracking-wide bg-orange-900/60 hover:bg-orange-900/80 text-orange-200 border border-orange-700/40 transition-colors"
              >
                <Check className="h-3 w-3" />
                {plan.triage === "needs_reply"
                  ? "Draft reply"
                  : plan.triage === "waiting_on"
                  ? "Check & nudge"
                  : plan.urgent
                  ? "Review now"
                  : "Start with AI"}
              </button>
              <button
                onClick={onOpenWithAi}
                title="Open with AI"
                className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-white/30 transition-colors hover:text-white/65 hover:bg-white/6"
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

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
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

  const candidates = useMemo(() => {
    const today = todayKey();
    const nowMs = Date.now();
    const scored = threads
      .filter((thread) => {
        if (doneThreads.has(thread.id)) return false;
        if (snoozedThreads.some((s) => s.threadId === thread.id)) return false;
        // Skip threads the user has explicitly suppressed from the briefing
        const suppressedUntil = dismissedThreads[thread.id];
        if (suppressedUntil && suppressedUntil >= today) return false;

        // Soft-suppress anything we already surfaced in a previous briefing,
        // unless fresh activity arrived or it's been several days.
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
          // User has read it in the inbox since we showed it, and nothing new
          // came in → assume it's been handled and don't re-surface.
          if (!hasNewActivity && !thread.isUnread) return false;
        }
        return true;
      })
      .map((thread) => {
        const triage = triageMap[thread.id];
        const category = categoryMap[thread.id];
        const commitmentCount = commitments.filter((c) => c.threadId === thread.id).length;

        const ageDays = (Date.now() - new Date(thread.lastMessageAt).getTime()) / 86_400_000;

        // Hard cutoff: very old threads only if urgent with active commitments
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
        // Filter out noise: automated and low-signal
        if (item.category === "automated" && !item.thread.isUrgent && item.triage !== "needs_reply") return false;

        // General-usage "seen" detection: if we've never briefed this thread
        // and the user has already read it in the normal inbox, and nothing
        // about it demands attention, assume they've made their call.
        const wasShown = shownHistory[item.thread.id];
        if (!wasShown && !item.thread.isUnread) {
          const actionable =
            item.thread.isUrgent ||
            item.triage === "needs_reply" ||
            item.commitmentCount > 0;
          if (!actionable) return false;
        }

        // Drop threads with a negative score (old + low signal)
        return item.score > 0;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.maxItems)
      .map(({ thread, triage, category, commitmentCount }) => ({
        threadId: thread.id,
        platform: thread.platform,
        subject: thread.subject,
        sender: thread.participants[0]?.name || thread.participants[0]?.email || "Unknown",
        snippet: thread.snippet ?? "",
        summary: buildSummary(thread, triage, commitmentCount),
        plan: buildPlan(thread, triage, category, commitmentCount),
        category,
        triage,
        urgent: thread.isUrgent,
        commitmentCount,
        ageLabel: formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true }),
      }));

    return scored;
  }, [threads, triageMap, categoryMap, commitments, doneThreads, snoozedThreads, settings.maxItems, dismissedThreads, shownHistory]);

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

  // ─── AI enrichment: fetch per-card summaries + needsAction ───────────────
  // Fires once per modal open (not on re-open from minimized since aiSummary already set)
  useEffect(() => {
    if (!open) {
      enrichAbort.current?.abort();
      return;
    }
    // Skip if all plans already have AI enrichment (re-opened from minimized)
    if (plans.length === 0 || plans.every((p) => p.aiSummary !== undefined && p.aiPlan !== undefined)) return;

    const controller = new AbortController();
    enrichAbort.current = controller;

    const snapshot = plans.map((p) => ({
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

    // Flag all cards without an AI plan yet as loading, so the UI can skeleton
    // the plan text instead of showing the generic heuristic fallback.
    setPlans((prev) =>
      prev.map((p) => (p.aiPlan !== undefined ? p : { ...p, planLoading: true })),
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
        setPlans((prev) =>
          prev.map((p) => {
            const ai = (
              data.cards as {
                threadId: string;
                summary: string;
                needsAction: boolean;
                plan?: string;
              }[]
            ).find((c) => c.threadId === p.threadId);
            if (!ai) return { ...p, planLoading: false };
            return {
              ...p,
              aiSummary: ai.summary,
              needsAction: ai.needsAction,
              aiPlan: ai.plan?.trim() || p.plan,
              planLoading: false,
            };
          }),
        );
      } catch {
        // Silently fall back to heuristic plan/summary
        setPlans((prev) => prev.map((p) => ({ ...p, planLoading: false })));
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function handleOpen() {
      setPlans(candidates);
      setOpen(true);
      const byId = new Map(threads.map((t) => [t.id, t]));
      recordShownBriefing(candidates, byId);
      setShownHistory(loadShownHistory());
    }
    function handleStorage() {
      setSettings(loadMorningSettings());
    }
    window.addEventListener("dirac:open-morning-briefing", handleOpen);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("dirac:open-morning-briefing", handleOpen);
      window.removeEventListener("storage", handleStorage);
    };
  }, [candidates, threads]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/inbox") return;
    if (!settings.enabled) return;
    if (threadsLoading || triageLoading || categoryLoading) return;
    if (threads.length === 0) return;

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

    if (candidates.length > 0) {
      hasAutoOpened.current = today;
      // Write the key immediately — modal opening = briefed for today.
      // This means refresh or SPA navigation won't re-trigger it.
      window.localStorage.setItem(getMorningStorageKey(), "1");
      setPlans(candidates);
      setOpen(true);
      const byId = new Map(threads.map((t) => [t.id, t]));
      recordShownBriefing(candidates, byId);
      setShownHistory(loadShownHistory());
    }
  }, [pathname, settings, threadsLoading, triageLoading, categoryLoading, threads, candidates]);

  const minimize = () => {
    setOpen(false);
    setMinimized(true);
  };

  const reopenFromMinimized = () => {
    skipNextShimmer.current = true;
    setMinimized(false);
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
    refreshDismissed();
    setPlans((prev) => prev.filter((p) => p.threadId !== threadId));
  };

  const closeForToday = () => {
    // localStorage key already written when modal opened — just close
    setMinimized(false);
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

      {/* Floating minimized pill */}
      <AnimatePresence>
        {minimized && !open && (
          <motion.button
            key="morning-pill"
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onClick={reopenFromMinimized}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-white/12 bg-black/95 px-4 py-2.5 shadow-lg backdrop-blur-sm text-[13px] font-medium text-white/80 hover:bg-white/6 transition-colors"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-400/70" />
            Morning Brief
            {plans.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500/15 px-1 font-mono text-[10px] font-semibold text-orange-400/80 not-italic" style={{ fontFamily: "inherit" }}>
                {plans.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
