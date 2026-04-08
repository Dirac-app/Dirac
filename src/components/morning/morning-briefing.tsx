"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, getHours } from "date-fns";
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
  subject: string;
  sender: string;
  snippet: string;
  summary: string;
  aiSummary?: string;
  needsAction?: boolean;
  plan: string;
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
      className="rounded-xl border border-border/60 bg-background px-4 py-3.5 animate-pulse"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <SkeletonBar w="w-52" h="h-3.5" />
        <SkeletonBar w="w-14" h="h-3.5" opacity="opacity-35" />
      </div>
      <SkeletonBar w="w-28" h="h-2.5" opacity="opacity-30" />
      <div className="mt-3 space-y-1.5">
        <SkeletonBar w="w-full" opacity="opacity-45" />
        <SkeletonBar w="w-4/5" opacity="opacity-35" />
        <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
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

// ── Real plan card ─────────────────────────────────────────────────────────

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
  const accentColor = plan.urgent
    ? "border-l-rose-500/50"
    : plan.triage === "needs_reply"
      ? "border-l-sky-500/40"
      : plan.triage === "waiting_on"
        ? "border-l-indigo-400/40"
        : "border-l-border/0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "rounded-xl border border-border/60 bg-background pl-4 pr-4 py-3.5 border-l-2",
        accentColor,
      )}
    >
      {/* Header — single row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13.5px] font-semibold text-foreground leading-snug truncate">{plan.subject}</h3>
            {plan.category && (
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", FOUNDER_CATEGORY_COLORS[plan.category])}>
                {FOUNDER_CATEGORY_LABELS[plan.category]}
              </span>
            )}
            {plan.commitmentCount > 0 && (
              <span className="shrink-0 rounded bg-amber-500/8 dark:bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600/80 dark:text-amber-300/70">
                {plan.commitmentCount} commit{plan.commitmentCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground/60">
            {plan.sender} · {plan.ageLabel}
          </p>
        </div>
        <button
          onClick={onDismiss}
          title="Dismiss"
          className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground/25 transition-colors hover:text-rose-500/70 hover:bg-rose-500/5"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Content — single column, summary → divider → plan */}
      <div className="mt-2.5 rounded-lg bg-accent/20 px-3 py-2.5">
        {/* Summary */}
        {plan.aiSummary ? (
          <p className="text-[12.5px] leading-[1.6] text-foreground/80">{plan.aiSummary}</p>
        ) : (
          <div className="space-y-1.5 animate-pulse py-0.5">
            <div className="h-2.5 w-full rounded-md bg-muted/60" />
            <div className="h-2.5 w-3/4 rounded-md bg-muted/45" />
          </div>
        )}

        {/* Divider + plan */}
        <div className="mt-2 pt-2 border-t border-border/30">
          <div className="flex items-start justify-between gap-2">
            {isEditing ? (
              <textarea
                value={plan.plan}
                onChange={(e) => onPlanChange(e.target.value)}
                className="flex-1 min-h-[72px] resize-none rounded-md border border-border bg-background px-2.5 py-2 text-[12.5px] leading-[1.6] text-foreground/80 outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <p className="flex-1 text-[12.5px] leading-[1.6] text-muted-foreground/90 italic">{plan.plan}</p>
            )}
            <button
              onClick={onEdit}
              title={isEditing ? "Done" : "Edit plan"}
              className={cn(
                "mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded transition-colors",
                isEditing
                  ? "text-primary hover:text-primary"
                  : "text-foreground/60 hover:text-foreground"
              )}
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Actions — minimal */}
      <div className="mt-2.5 flex items-center gap-1.5">
        {plan.needsAction !== false && (
          <>
            <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={onAccept}>
              <Check className="h-3 w-3" />
              Accept plan
            </Button>
            <button
              onClick={onOpenWithAi}
              title="Open with AI"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground/60 transition-colors hover:text-foreground hover:border-border hover:bg-accent/40"
            >
              <Sparkles className="h-3 w-3" />
            </button>
          </>
        )}
        <button
          onClick={onOpenThread}
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground",
            plan.needsAction !== false ? "ml-1" : "",
          )}
        >
          <ArrowRight className="h-3 w-3" />
          Open thread
        </button>
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
  } = useAppState();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [plans, setPlans] = useState<MorningPlanCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MorningBriefSettings>(DEFAULT_SETTINGS);
  const [dismissedThreads, setDismissedThreads] = useState<Record<string, string>>({});
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextShimmer = useRef(false);
  const hasAutoOpened = useRef<string | null>(null); // stores the date shown, handles overnight tabs
  const enrichAbort = useRef<AbortController | null>(null);

  const candidates = useMemo(() => {
    const today = todayKey();
    const scored = threads
      .filter((thread) => {
        if (doneThreads.has(thread.id)) return false;
        if (snoozedThreads.some((s) => s.threadId === thread.id)) return false;
        // Skip threads the user has explicitly suppressed from the briefing
        const suppressedUntil = dismissedThreads[thread.id];
        if (suppressedUntil && suppressedUntil >= today) return false;
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
        // Drop threads with a negative score (old + low signal)
        return item.score > 0;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.maxItems)
      .map(({ thread, triage, category, commitmentCount }) => ({
        threadId: thread.id,
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
  }, [threads, triageMap, categoryMap, commitments, doneThreads, snoozedThreads, settings.maxItems, dismissedThreads]);

  useEffect(() => {
    setSettings(loadMorningSettings());
    setDismissedThreads(loadDismissedThreads());
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
    // Skip if all plans already have AI summaries (re-opened from minimized)
    if (plans.length === 0 || plans.every((p) => p.aiSummary !== undefined)) return;

    const controller = new AbortController();
    enrichAbort.current = controller;

    const snapshot = plans.map((p) => ({
      threadId: p.threadId,
      subject: p.subject,
      sender: p.sender,
      snippet: p.snippet,
    }));

    (async () => {
      try {
        const res = await fetch("/api/ai/morning-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards: snapshot }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.cards) return;
        setPlans((prev) =>
          prev.map((p) => {
            const ai = (data.cards as { threadId: string; summary: string; needsAction: boolean }[]).find(
              (c) => c.threadId === p.threadId,
            );
            if (!ai) return p;
            return { ...p, aiSummary: ai.summary, needsAction: ai.needsAction };
          }),
        );
      } catch {
        // Silently fall back to heuristic summaries
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function handleOpen() {
      setPlans(candidates);
      setOpen(true);
    }    function handleStorage() {
      setSettings(loadMorningSettings());
    }
    window.addEventListener("dirac:open-morning-briefing", handleOpen);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("dirac:open-morning-briefing", handleOpen);
      window.removeEventListener("storage", handleStorage);
    };
  }, [candidates]);

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
    }
  }, [pathname, settings, threadsLoading, triageLoading, categoryLoading, threads.length, candidates]);

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

  const acceptPlan = (plan: MorningPlanCard) => {
    suppressThread(plan.threadId, 2); // acted on — rest for 2 days
    refreshDismissed();
    addToAiContext({ id: plan.threadId, label: plan.subject });
    setPendingAiQuery(plan.plan);
    setAiSidebarOpen(true);
    setSelectedThreadId(plan.threadId);
    minimize();
  };

  const openWithAi = (plan: MorningPlanCard) => {
    suppressThread(plan.threadId, 2);
    refreshDismissed();
    addToAiContext({ id: plan.threadId, label: plan.subject });
    setPendingAiQuery(`Help me execute this plan for "${plan.subject}": ${plan.plan}`);
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

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) minimize(); }}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0" showCloseButton={false}>

        {/* Header */}
        <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                <Sparkles className="h-4 w-4 text-primary/70" />
                Morning briefing
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground/70 max-w-xl">
                Dirac ranked the threads most likely to matter this morning and drafted a next move for each.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeForToday}
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Not now
            </Button>
          </div>
        </DialogHeader>

        {/* Card grid */}
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {!revealed ? (
                // Skeleton phase
                <motion.div
                  key="skeletons"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-3"
                >
                  {Array.from({ length: skeletonCount }).map((_, i) => (
                    <PlanCardSkeleton key={i} index={i} />
                  ))}
                </motion.div>
              ) : plans.length === 0 ? (
                // Empty state
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center"
                >
                  <Inbox className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">No morning plans left</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">You've cleared everything in today's briefing.</p>
                </motion.div>
              ) : (
                // Real cards
                <motion.div
                  key="cards"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-3"
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
                            setPlans((prev) => prev.map((p) =>
                              p.threadId === plan.threadId ? { ...p, plan: val } : p
                            ))
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
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-3.5 text-[11px] text-muted-foreground/50">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Shows once per day · stays optional
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Suggestions are editable before you act
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
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm text-[13px] font-medium text-foreground hover:bg-accent/50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            Morning briefing
            {plans.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/12 px-1 text-[10px] font-semibold text-primary/80">
                {plans.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
