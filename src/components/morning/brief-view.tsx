"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Inbox, ArrowUpRight } from "lucide-react";
import { ThreadCard } from "@/components/inbox/thread-card";
import { useAppState } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FounderCategory, TriageCategory, DiracThread } from "@/lib/types";
import { loadSenderStatsMap, type SenderStatsMap } from "@/lib/sender-stats";
import {
  loadPendingStore,
  savePendingBrief,
  removePendingThread,
  hasValidBriefEnrichment,
  saveEnrichmentCache,
} from "@/lib/morning-brief-pending";
import { MORNING_BRIEF_PENDING_CHANGED } from "@/lib/morning-brief-pending";
import {
  PlanCardContent,
  PlanCardSkeleton,
  buildPlanCardFromThread,
  hydratePendingPlans,
  syncPendingStoreAfterHydrate,
  resolveBriefPlansForOpen,
  computeBriefCandidates,
  loadMorningSettings,
  loadDismissedThreads,
  loadShownHistory,
  recordShownBriefing,
  suppressThread,
  todayKey,
  type MorningPlanCard,
} from "./morning-briefing";

// ── On-the-fly draft state per thread ─────────────────────────────────────

interface DraftState {
  loading: boolean;
  text: string | null;
  error: boolean;
}

// ── Section tiering ────────────────────────────────────────────────────────
// "Needs a decision": urgent OR non-needs_reply triage (waiting_on / fyi / ambiguous)
// "Drafted, ready to send": !urgent && triage === "needs_reply" (clear reply path)
// "Handled": reserved for Prompt 3; currently always 0

function tierCard(plan: MorningPlanCard): "decision" | "drafted" {
  if (plan.urgent || plan.triage !== "needs_reply") return "decision";
  return "drafted";
}

// ── AI enrichment: same flow as the modal ─────────────────────────────────

async function enrichCards(
  plans: MorningPlanCard[],
  signal: AbortSignal,
): Promise<Map<string, { aiSummary: string; aiPlan: string; needsAction: boolean }>> {
  const needsEnrichment = plans.filter((p) => !hasValidBriefEnrichment(p));
  if (needsEnrichment.length === 0) return new Map();

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

  const res = await fetch("/api/ai/morning-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cards: snapshot }),
    signal,
  });

  if (!res.ok) return new Map();
  const data = await res.json();
  if (!data.cards) return new Map();

  const result = new Map<
    string,
    { aiSummary: string; aiPlan: string; needsAction: boolean }
  >();
  for (const c of data.cards as {
    threadId: string;
    summary: string;
    needsAction: boolean;
    plan?: string;
  }[]) {
    if (c.summary?.trim() && c.plan?.trim()) {
      result.set(c.threadId, {
        aiSummary: c.summary.trim(),
        aiPlan: c.plan.trim(),
        needsAction: c.needsAction,
      });
    }
  }
  return result;
}

// ── Fetch thread context for draft generation (same as thread-view.tsx) ────

async function fetchThreadContext(
  threadId: string,
  platform: string,
): Promise<{ from: string; body: string; sentAt: string }[] | null> {
  const isOutlook = platform === "OUTLOOK";
  const url = isOutlook
    ? `/api/outlook/threads/${threadId}`
    : `/api/gmail/threads/${threadId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.messages ?? []).map(
    (m: { fromName: string; bodyText: string; sentAt: string }) => ({
      from: m.fromName,
      body: m.bodyText,
      sentAt: m.sentAt,
    }),
  );
}

// ── Generate a single draft for a card ────────────────────────────────────

async function generateDraft(
  plan: MorningPlanCard,
  toneProfile: ReturnType<typeof useAppState>["toneProfile"],
  signal: AbortSignal,
): Promise<string | null> {
  const messages = await fetchThreadContext(plan.threadId, plan.platform);
  if (signal.aborted) return null;

  const preset =
    typeof window !== "undefined"
      ? (localStorage.getItem("dirac-ai-preset") ?? undefined)
      : undefined;

  const actionLabel = `Reply to this email${plan.triage === "waiting_on" ? " (follow-up nudge)" : ""}${plan.category ? ` (${plan.category} thread)` : ""}`;

  const res = await fetch("/api/ai/quick-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionLabel,
      threadSubject: plan.subject,
      messages: messages ?? [],
      toneProfile: toneProfile ?? undefined,
      preset,
    }),
    signal,
  });

  if (!res.ok) return null;
  const data = await res.json();
  const options = data.options ?? [];
  return options[0]?.body ?? null;
}

const BRIEF_NAV_FLAG = "dirac:nav-from-brief";

/** Set before any router.push("/inbox") from the brief page so the inbox
 *  back button returns to /brief instead of staying on /inbox. */
function markNavFromBrief() {
  if (typeof window !== "undefined") sessionStorage.setItem(BRIEF_NAV_FLAG, "1");
}

// ── Handled section ────────────────────────────────────────────────────────

// ── BundleRow — expandable bundle row with inline thread list ─────────────

interface BundleRowProps {
  slug: string;
  bundleThreads: DiracThread[];
  label: string;
  onUndo: () => void;
  onViewAll: () => void;
}

/** Shared thread list + footer used by both BundleRow and ProposalBundleRow */
function BundleThreadList({
  bundleThreads,
  onViewAll,
  footer,
}: {
  bundleThreads: DiracThread[];
  onViewAll: () => void;
  footer?: React.ReactNode;
}) {
  const {
    threads: liveThreads,
    triageMap,
    categoryMap,
    commitments,
    doneThreads,
    selectedThreadId,
    selectedThreadIds,
    setSelectedThreadId,
    toggleBulkSelect,
    clearSelection,
  } = useAppState();
  const router = useRouter();

  // Prefer live thread data (reflects real-time state like isStarred) over
  // the snapshot stored at fire time. Fall back to snapshot for archived threads
  // that no longer appear in the inbox.
  const liveById = useMemo(
    () => new Map(liveThreads.map((t) => [t.id, t])),
    [liveThreads],
  );
  const resolvedThreads = bundleThreads.map((t) => liveById.get(t.id) ?? t);
  const bulkThreads = resolvedThreads.filter((t) => selectedThreadIds.has(t.id));

  return (
    <div className="border-t border-white/6">
      <div className="flex flex-col">
        {resolvedThreads.map((t) => (
          <ThreadCard
            key={t.id}
            thread={t}
            isSelected={selectedThreadId === t.id}
            isBulkSelected={selectedThreadIds.has(t.id)}
            onSelect={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) {
                toggleBulkSelect(t.id);
              } else {
                setSelectedThreadId(t.id);
                clearSelection();
                markNavFromBrief(); router.push("/inbox");
              }
            }}
            bulkThreads={bulkThreads.length > 1 ? bulkThreads : [t]}
            triage={triageMap[t.id]}
            category={categoryMap[t.id]}
            commitmentCount={commitments.filter((c) => c.threadId === t.id).length}
            isDone={doneThreads.has(t.id)}
          />
        ))}
      </div>

      <div className="px-3 py-2.5 border-t border-white/8 flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/25">
          {bundleThreads.length} thread{bundleThreads.length !== 1 ? "s" : ""}
        </span>
        {footer ?? (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-white/55 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            View all in inbox
            <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function BundleRow({ bundleThreads, label, onUndo, onViewAll }: BundleRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-white/6 bg-black/40 overflow-hidden">
      {/* Row header — left side expands, right side is undo */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          <span className="font-mono text-[11px] text-white/55 shrink-0">
            <span className="text-white/75 font-medium">{bundleThreads.length}</span>
            {" · "}
            {label}
          </span>
          {open ? (
            <ChevronDown className="h-3 w-3 text-white/25 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-white/25 shrink-0" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUndo(); }}
          className="shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-white/28 hover:text-white/60 transition-colors"
        >
          Undo
        </button>
      </div>

      {open && (
        <BundleThreadList
          bundleThreads={bundleThreads}
          onViewAll={onViewAll}
        />
      )}
    </div>
  );
}

// ── ProposalBundleRow — same expand mechanics but with Approve/Dismiss footer

interface ProposalBundleRowProps {
  bundleThreads: DiracThread[];
  label: string;
  onApprove: () => void;
  onDismiss: () => void;
  onViewAll: () => void;
}

function ProposalBundleRow({
  bundleThreads,
  label,
  onApprove,
  onDismiss,
  onViewAll,
}: ProposalBundleRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-amber-400/12 bg-black/40 overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          <span className="font-mono text-[11px] text-white/55 shrink-0">
            <span className="text-white/75 font-medium">{bundleThreads.length}</span>
            {" · "}
            {label}
          </span>
          {open ? (
            <ChevronDown className="h-3 w-3 text-white/25 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-white/25 shrink-0" />
          )}
        </button>
        {/* Inline approve/dismiss — always visible in the header row */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="rounded bg-white/8 px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-white/65 hover:bg-white/14 hover:text-white/90 transition-colors"
          >
            Archive all
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/28 hover:text-white/55 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>

      {open && (
        <BundleThreadList
          bundleThreads={bundleThreads}
          onViewAll={onViewAll}
          footer={
            <div className="flex items-center gap-2">
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 rounded-lg bg-white/8 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-white/70 hover:bg-white/14 hover:text-white/90 transition-colors"
              >
                Archive all
              </button>
              <button
                onClick={onViewAll}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-white/55 hover:bg-white/10 hover:text-white/80 transition-colors"
              >
                View all in inbox
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

// ── Handled section ────────────────────────────────────────────────────────

interface HandledSectionProps {
  notificationBundles: Record<string, DiracThread[]>;
  // Propose-and-confirm archive (low-value, NOT high confidence)
  proposeArchiveCandidates: DiracThread[];
  newsletterProposal: ProposalState;
  onApproveNewsletters: () => void;
  onDismissNewsletters: () => void;
  onUndoNewsletterArchive: () => void;
  // Auto-fired bundles
  autoStarBundle: AutoBundleState;
  autoArchiveT2Bundle: AutoBundleState;
  onUndoAutoStar: () => void;
  onUndoAutoArchiveT2: () => void;
  // Shared
  onUndoBundle: (
    bundleKey: string,
    threads: DiracThread[],
    label: string,
  ) => void;
  onViewAll: (ids: string[]) => void;
  handledCount: number;
}

function HandledSection({
  notificationBundles,
  proposeArchiveCandidates,
  newsletterProposal,
  onApproveNewsletters,
  onDismissNewsletters,
  onUndoNewsletterArchive,
  autoStarBundle,
  autoArchiveT2Bundle,
  onUndoAutoStar,
  onUndoAutoArchiveT2,
  onUndoBundle,
  onViewAll,
  handledCount,
}: HandledSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const hasBundles = Object.keys(notificationBundles).length > 0;
  const hasAutoStar = autoStarBundle.fired && !autoStarBundle.undone && autoStarBundle.threads.length > 0;
  const hasAutoArchiveT2 = autoArchiveT2Bundle.fired && !autoArchiveT2Bundle.undone && autoArchiveT2Bundle.threads.length > 0;
  const hasNewsletterProposal =
    proposeArchiveCandidates.length > 0 && newsletterProposal === "pending";
  const hasProposals = hasNewsletterProposal;
  const isEmpty = !hasBundles && !hasAutoStar && !hasAutoArchiveT2 && !hasProposals;

  // Canonical slug labels
  const slugLabel = (slug: string) => {
    const labels: Record<string, string> = {
      receipts: "Receipts",
      newsletters: "Newsletters",
      "builds & deploys": "Builds & deploys",
      alerts: "Alerts",
      notifications: "Notifications",
      social: "Social",
      "product updates": "Product updates",
      onboarding: "Onboarding",
      marketing: "Marketing",
      forums: "Forums",
      team: "Team",
      security: "Security",
    };
    return labels[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  };

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
      >
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase text-white/55 font-semibold">
          Auto-grouped
          {handledCount > 0 && (
            <span className="text-white/30 font-normal">{handledCount}</span>
          )}
          {hasProposals && (
            <span className="rounded-sm bg-amber-400/15 px-1.5 py-0.5 text-[9px] text-amber-300/80 font-semibold tracking-[0.1em]">
              {hasNewsletterProposal ? 1 : 0} ready
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-white/25" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-white/25" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4">
          {isEmpty && (
            <p className="font-mono text-[10px] text-white/30">
              Nothing grouped yet.
            </p>
          )}

          {/* ── TIER 1: Auto-starred investor/urgent threads ────────────── */}
          {hasAutoStar && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/28 mb-2">
                Starred automatically
              </p>
              <BundleRow
                slug="__auto_star__"
                bundleThreads={autoStarBundle.threads}
                label={`${autoStarBundle.threads.length} investor thread${autoStarBundle.threads.length !== 1 ? "s" : ""} starred`}
                onUndo={onUndoAutoStar}
                onViewAll={() => onViewAll(autoStarBundle.threads.map((t) => t.id))}
              />
            </div>
          )}

          {/* ── TIER 2: Auto-archived high-confidence threads ──────────── */}
          {hasAutoArchiveT2 && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/28 mb-2">
                Archived automatically · known senders, reversible
              </p>
              <BundleRow
                slug="__auto_archive_t2__"
                bundleThreads={autoArchiveT2Bundle.threads}
                label={`${autoArchiveT2Bundle.threads.length} archived`}
                onUndo={onUndoAutoArchiveT2}
                onViewAll={() => onViewAll(autoArchiveT2Bundle.threads.map((t) => t.id))}
              />
            </div>
          )}

          {/* ── SAFE bundles — each row expands inline ────────────────── */}
          {hasBundles && (
            <div className="space-y-1.5">
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/28 mb-2">
                Grouped automatically · view-only, no changes made
              </p>
              {Object.entries(notificationBundles).map(([slug, bundleThreads]) => (
                <BundleRow
                  key={slug}
                  slug={slug}
                  bundleThreads={bundleThreads}
                  label={slugLabel(slug)}
                  onUndo={() => onUndoBundle(slug, bundleThreads, slugLabel(slug))}
                  onViewAll={() => onViewAll(bundleThreads.map((t) => t.id))}
                />
              ))}
            </div>
          )}

          {/* ── Propose-and-confirm archive ────────────────────────────── */}
          {proposeArchiveCandidates.length > 0 && hasNewsletterProposal && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/28 mb-2">
                Ready for your approval
              </p>
              <ProposalBundleRow
                bundleThreads={proposeArchiveCandidates}
                label={`newsletter${proposeArchiveCandidates.length !== 1 ? "s" : ""} ready to archive`}
                onApprove={onApproveNewsletters}
                onDismiss={onDismissNewsletters}
                onViewAll={() => onViewAll(proposeArchiveCandidates.map((t) => t.id))}
              />
            </div>
          )}
          {(newsletterProposal as ProposalState) === "approved" && proposeArchiveCandidates.length > 0 && (
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] text-white/35">
                {proposeArchiveCandidates.length} newsletter
                {proposeArchiveCandidates.length !== 1 ? "s" : ""} archived
              </p>
              <button
                onClick={onUndoNewsletterArchive}
                className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/28 hover:text-white/60 transition-colors"
              >
                · undo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-white/55 font-semibold">
        {label}
      </span>
      <span className="font-mono text-[11px] text-white/30">{count}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ── Daily-keyed localStorage helpers for proposal + bundle state ──────────
// Keys rotate each day so stale decisions don't carry over.

const BRIEF_NEWSLETTER_PROPOSAL_KEY = () =>
  `dirac_brief_newsletter_proposal_${todayKey()}`;
const BRIEF_AUTO_STAR_KEY = () =>
  `dirac_brief_auto_star_v1_${todayKey()}`;
const BRIEF_AUTO_ARCHIVE_T2_KEY = () =>
  `dirac_brief_auto_archive_t2_v1_${todayKey()}`;
const BRIEF_UNBUNDLED_KEYS_KEY = () =>
  `dirac_brief_unbundled_keys_${todayKey()}`;

type ProposalState = "pending" | "approved" | "dismissed";

function loadProposalState(key: string): ProposalState {
  if (typeof window === "undefined") return "pending";
  const v = window.localStorage.getItem(key);
  if (v === "approved" || v === "dismissed") return v;
  return "pending";
}

function saveProposalState(key: string, value: ProposalState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function loadUnbundledKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(BRIEF_UNBUNDLED_KEYS_KEY());
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveUnbundledKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BRIEF_UNBUNDLED_KEYS_KEY(),
    JSON.stringify([...keys]),
  );
}

// ── AutoBundleState — persisted daily for auto-star and auto-archive-T2 ──
// Stores which threads were acted on so that on refresh we show the summary
// without re-firing the action.

interface AutoBundleState {
  fired: boolean;
  undone: boolean;
  threads: DiracThread[]; // snapshot captured at fire time
}

const EMPTY_AUTO_BUNDLE: AutoBundleState = { fired: false, undone: false, threads: [] };

function loadAutoBundle(key: string): AutoBundleState {
  if (typeof window === "undefined") return EMPTY_AUTO_BUNDLE;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_AUTO_BUNDLE;
    return JSON.parse(raw) as AutoBundleState;
  } catch {
    return EMPTY_AUTO_BUNDLE;
  }
}

function saveAutoBundle(key: string, state: AutoBundleState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ── Archive-tier classification helpers ────────────────────────────────────

/** Returns true if the thread belongs to a clearly low-value category
 *  that is eligible for auto-archive consideration. */
function isLowValueArchivable(
  t: DiracThread,
  categoryTabMap: Record<string, string | undefined>,
): boolean {
  const slug = categoryTabMap[t.id];
  if (slug === "newsletters" || slug === "notifications") return true;
  // No slug but Gmail says promo/social
  if (!slug) {
    if (t.gmailCategory === "CATEGORY_PROMOTIONS") return true;
    if (t.gmailCategory === "CATEGORY_SOCIAL") return true;
  }
  return false;
}

const HIGH_CONFIDENCE_MIN_DAYS = 7;

/** Returns true when the thread's primary sender is a known sender whose first
 *  appearance is at least HIGH_CONFIDENCE_MIN_DAYS days ago.  A brand-new or
 *  unknown sender returns false — never auto-archive on a guess. */
function isHighConfidenceForArchive(
  t: DiracThread,
  statsMap: SenderStatsMap,
): boolean {
  const email = t.participants[0]?.email?.toLowerCase();
  if (!email) return false;
  const stat = statsMap[email];
  if (!stat) return false;
  const firstSeen = new Date(stat.firstSeenAt);
  const threshold = new Date(Date.now() - HIGH_CONFIDENCE_MIN_DAYS * 24 * 60 * 60 * 1000);
  return firstSeen < threshold;
}

// ── Main BriefView component ───────────────────────────────────────────────

export function BriefView() {
  const {
    threads,
    triageMap,
    categoryMap,
    categoryTabMap,
    commitments,
    doneThreads,
    snoozedThreads,
    threadsLoading,
    triageLoading,
    categoryLoading,
    toneProfile,
    setSelectedThreadId,
    setAiSidebarOpen,
    setPendingAiQuery,
    addToAiContext,
    clearAiContext,
    archiveThread,
    unarchiveThread,
    toggleStarred,
    pushUndoAction,
    openViewAll,
    performUndo,
    sendThreadReply,
  } = useAppState();
  const { toast } = useToast();
  const router = useRouter();

  const [plans, setPlans] = useState<MorningPlanCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dismissedThreads, setDismissedThreads] = useState<
    Record<string, string>
  >({});
  const [pendingRevision, setPendingRevision] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Per-card draft state (keyed by threadId)
  const [draftStates, setDraftStates] = useState<Record<string, DraftState>>(
    {},
  );

  // Send state per thread (for inline send in drafted cards)
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const enrichAbort = useRef<AbortController | null>(null);
  const draftAborts = useRef<Map<string, AbortController>>(new Map());
  const hasInitialized = useRef(false);

  // ── Handled section state ───────────────────────────────────────────────

  // Set of bundle keys whose "undo" was tapped — persisted daily
  const [unbundledKeys, setUnbundledKeys] = useState<Set<string>>(() =>
    loadUnbundledKeys(),
  );
  // Proposal state for propose-and-confirm archive — persisted daily
  const [newsletterProposal, setNewsletterProposal] = useState<ProposalState>(
    () => loadProposalState(BRIEF_NEWSLETTER_PROPOSAL_KEY()),
  );
  // Auto-fired bundle states — persisted daily
  const [autoStarBundle, setAutoStarBundle] = useState<AutoBundleState>(() =>
    loadAutoBundle(BRIEF_AUTO_STAR_KEY()),
  );
  const [autoArchiveT2Bundle, setAutoArchiveT2Bundle] = useState<AutoBundleState>(() =>
    loadAutoBundle(BRIEF_AUTO_ARCHIVE_T2_KEY()),
  );

  // ── Load static state on mount ──────────────────────────────────────────

  useEffect(() => {
    setDismissedThreads(loadDismissedThreads());
  }, []);

  // ── Listen for bundle undo event from the undo-toast handler ───────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { bundleKey } = (e as CustomEvent<{ bundleKey: string }>).detail;
      if (bundleKey !== undefined) {
        setUnbundledKeys((prev) => {
          const next = new Set([...prev, bundleKey]);
          saveUnbundledKeys(next);
          return next;
        });
      }
    };
    window.addEventListener("dirac:undo-bundle", handler);
    return () => window.removeEventListener("dirac:undo-bundle", handler);
  }, []);

  // ── Listen for pending-store changes ───────────────────────────────────

  useEffect(() => {
    const handler = () => setPendingRevision((n) => n + 1);
    window.addEventListener(MORNING_BRIEF_PENDING_CHANGED, handler);
    return () =>
      window.removeEventListener(MORNING_BRIEF_PENDING_CHANGED, handler);
  }, []);

  // ── Compute pending thread ids ─────────────────────────────────────────

  const pendingThreadIds = useMemo(() => {
    const store = loadPendingStore();
    return new Set(store?.cards.map((c) => c.threadId) ?? []);
  }, [dismissedThreads, plans.length, pendingRevision]);

  // ── Hydrated pending cards ─────────────────────────────────────────────

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

  // ── Scored candidates ──────────────────────────────────────────────────

  const settings = useMemo(() => loadMorningSettings(), []);
  const shownHistory = useMemo(() => loadShownHistory(), []);

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
      dismissedThreads,
      shownHistory,
      pendingThreadIds,
      settings.maxItems,
    ],
  );

  // ── Initialize brief session once data is ready ────────────────────────

  useEffect(() => {
    if (threadsLoading || triageLoading || categoryLoading) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

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
    const byId = new Map(threads.map((t) => [t.id, t]));

    if (!store?.cards.length && candidates.length > 0) {
      // First open of the day — persist candidates as the day's queue
      savePendingBrief(candidates);
      recordShownBriefing(candidates, byId);
      setPlans(candidates);
    } else {
      // Returning to a brief that already has cards. Merge in any fresh
      // high-priority threads (urgent / needs_reply / waiting_on) that arrived
      // since the last open and aren't already in the brief.
      const inBrief = new Set(toShow.map((p) => p.threadId));
      const freshUrgent = candidates.filter(
        (c) =>
          !inBrief.has(c.threadId) &&
          (c.urgent || c.triage === "needs_reply" || c.triage === "waiting_on"),
      );
      if (freshUrgent.length > 0) {
        const merged = [...toShow, ...freshUrgent];
        savePendingBrief(merged);
        recordShownBriefing(freshUrgent, byId);
        setPlans(merged);
      } else {
        setPlans(toShow);
      }
    }

    setRevealed(true);
  }, [
    threadsLoading,
    triageLoading,
    categoryLoading,
    threads,
    triageMap,
    categoryMap,
    commitments,
    doneThreads,
    snoozedThreads,
    dismissedThreads,
    candidates,
  ]);

  // ── Refresh visible cards when hydrated pending changes ────────────────

  useEffect(() => {
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
  }, [hydratedPending]);

  // ── Keep pending store synced ──────────────────────────────────────────

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

  // ── Persist enrichment + pending on plan changes ───────────────────────

  useEffect(() => {
    if (plans.length === 0) return;
    saveEnrichmentCache(plans);
    savePendingBrief(plans, { notify: false });
  }, [plans]);

  // ── AI enrichment for cards missing it ────────────────────────────────

  const enrichmentKey = useMemo(
    () =>
      plans
        .map((p) => `${p.threadId}:${hasValidBriefEnrichment(p) ? "1" : "0"}`)
        .join("|"),
    [plans],
  );

  useEffect(() => {
    if (plans.length === 0) return;
    const needsEnrichment = plans.filter((p) => !hasValidBriefEnrichment(p));
    if (needsEnrichment.length === 0) return;

    const controller = new AbortController();
    enrichAbort.current?.abort();
    enrichAbort.current = controller;

    setPlans((prev) =>
      prev.map((p) =>
        hasValidBriefEnrichment(p) ? p : { ...p, planLoading: true },
      ),
    );

    enrichCards(needsEnrichment, controller.signal)
      .then((aiById) => {
        if (controller.signal.aborted) return;
        setPlans((prev) => {
          const next = prev.map((p) => {
            const ai = aiById.get(p.threadId);
            if (!ai) return { ...p, planLoading: false };
            return {
              ...p,
              aiSummary: ai.aiSummary,
              aiPlan: ai.aiPlan,
              needsAction: ai.needsAction,
              planLoading: false,
            };
          });
          saveEnrichmentCache(next);
          savePendingBrief(next, { notify: false });
          return next;
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlans((prev) => prev.map((p) => ({ ...p, planLoading: false })));
        }
      });

    return () => controller.abort();
  }, [enrichmentKey, plans.length]);

  // ── Tier partitioning ──────────────────────────────────────────────────

  const decisionCards = useMemo(
    () => plans.filter((p) => tierCard(p) === "decision"),
    [plans],
  );
  const draftedCards = useMemo(
    () => plans.filter((p) => tierCard(p) === "drafted"),
    [plans],
  );

  // ── Handled pool: threads not in plans, not done/snoozed ──────────────

  const planIds = useMemo(() => new Set(plans.map((p) => p.threadId)), [plans]);

  // Gmail categories that indicate automated/notification-type threads
  const PT_GMAIL_CATS = new Set([
    "CATEGORY_UPDATES",
    "CATEGORY_PROMOTIONS",
    "CATEGORY_SOCIAL",
    "CATEGORY_FORUMS",
  ]);

  const handledPool = useMemo(
    () =>
      threads.filter(
        (t) =>
          !planIds.has(t.id) &&
          !doneThreads.has(t.id) &&
          !snoozedThreads.some((s) => s.threadId === t.id),
      ),
    [threads, planIds, doneThreads, snoozedThreads],
  );

  // Sender stats map — loaded once per session (localStorage, stable)
  const senderStatsMap = useMemo(() => loadSenderStatsMap(), []);

  // TIER 1 AUTO-STAR: investor threads and urgent threads not yet starred
  const starCandidates = useMemo(
    () =>
      handledPool.filter(
        (t) => categoryMap[t.id] === "investor" && !t.isStarred,
      ),
    [handledPool, categoryMap],
  );

  const starCandidateIds = useMemo(
    () => new Set(starCandidates.map((t) => t.id)),
    [starCandidates],
  );

  // TIER 2 AUTO-ARCHIVE: clearly low-value category AND known sender (≥7 days)
  // NOT investor/urgent threads — those go to auto-star instead
  const tier2ArchiveCandidates = useMemo(
    () =>
      handledPool.filter(
        (t) =>
          !starCandidateIds.has(t.id) &&
          isLowValueArchivable(t, categoryTabMap) &&
          isHighConfidenceForArchive(t, senderStatsMap),
      ),
    [handledPool, starCandidateIds, categoryTabMap, senderStatsMap],
  );

  // PROPOSE-AND-CONFIRM: low-value category but NOT high confidence
  const proposeArchiveCandidates = useMemo(
    () =>
      handledPool.filter(
        (t) =>
          !starCandidateIds.has(t.id) &&
          isLowValueArchivable(t, categoryTabMap) &&
          !isHighConfidenceForArchive(t, senderStatsMap),
      ),
    [handledPool, starCandidateIds, categoryTabMap, senderStatsMap],
  );

  // IDs claimed by any archive tier (excluded from SAFE notification bundles)
  const archiveBoundaryIds = useMemo(
    () =>
      new Set([
        ...tier2ArchiveCandidates.map((t) => t.id),
        ...proposeArchiveCandidates.map((t) => t.id),
      ]),
    [tier2ArchiveCandidates, proposeArchiveCandidates],
  );

  // SAFE: notification bundles — group by categoryTabMap slug
  // Excludes anything handled by archive tiers or auto-star
  const notificationBundles = useMemo(() => {
    const grouped: Record<string, DiracThread[]> = {};
    for (const t of handledPool) {
      if (archiveBoundaryIds.has(t.id)) continue;
      if (starCandidateIds.has(t.id)) continue;
      if (
        !PT_GMAIL_CATS.has(t.gmailCategory ?? "") &&
        categoryMap[t.id] !== "automated"
      )
        continue;
      const slug = categoryTabMap[t.id] ?? t.gmailCategory ?? "notifications";
      if (!grouped[slug]) grouped[slug] = [];
      grouped[slug].push(t);
    }
    // Remove bundles the user has un-done
    for (const key of unbundledKeys) delete grouped[key];
    return grouped;
  }, [handledPool, categoryMap, categoryTabMap, unbundledKeys, archiveBoundaryIds, starCandidateIds]);

  // Total threads visually claimed by safe bundles (for the header count)
  const handledCount = useMemo(
    () =>
      Object.values(notificationBundles).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ) +
      (autoStarBundle.fired && !autoStarBundle.undone ? autoStarBundle.threads.length : 0) +
      (autoArchiveT2Bundle.fired && !autoArchiveT2Bundle.undone ? autoArchiveT2Bundle.threads.length : 0),
    [notificationBundles, autoStarBundle, autoArchiveT2Bundle],
  );

  // ── Auto-fire refs (prevent double-fire across React re-renders) ─────────

  const autoStarFiredRef = useRef(false);
  const autoArchiveT2FiredRef = useRef(false);

  // Stable refs so effects don't need starCandidates / tier2ArchiveCandidates
  // as dependencies (prevents re-firing when thread list refreshes).
  const starCandidatesRef = useRef<DiracThread[]>([]);
  starCandidatesRef.current = starCandidates;

  const tier2ArchiveCandidatesRef = useRef<DiracThread[]>([]);
  tier2ArchiveCandidatesRef.current = tier2ArchiveCandidates;

  // TIER 1 AUTO-STAR — fires once after brief opens
  useEffect(() => {
    if (!revealed) return;
    if (autoStarFiredRef.current) return;
    autoStarFiredRef.current = true;

    // Already fired today — restore persisted state for display
    const persisted = loadAutoBundle(BRIEF_AUTO_STAR_KEY());
    if (persisted.fired) {
      setAutoStarBundle(persisted);
      return;
    }

    const candidates = starCandidatesRef.current;
    if (candidates.length === 0) return;

    candidates.forEach((t) => toggleStarred(t.id, true));
    pushUndoAction({
      type: "batch_star",
      threadId: candidates[0].id,
      threadSubject: `${candidates.length} investor thread${candidates.length !== 1 ? "s" : ""}`,
      metadata: { threadIds: candidates.map((t) => t.id) },
    });

    const next: AutoBundleState = { fired: true, undone: false, threads: candidates };
    saveAutoBundle(BRIEF_AUTO_STAR_KEY(), next);
    setAutoStarBundle(next);
  }, [revealed, toggleStarred, pushUndoAction]);

  // TIER 2 AUTO-ARCHIVE — fires once after brief opens, HIGH confidence only
  useEffect(() => {
    if (!revealed) return;
    if (autoArchiveT2FiredRef.current) return;
    autoArchiveT2FiredRef.current = true;

    const persisted = loadAutoBundle(BRIEF_AUTO_ARCHIVE_T2_KEY());
    if (persisted.fired) {
      setAutoArchiveT2Bundle(persisted);
      return;
    }

    const candidates = tier2ArchiveCandidatesRef.current;
    if (candidates.length === 0) return;

    candidates.forEach((t) => archiveThread(t.id, true));
    pushUndoAction({
      type: "batch_archive",
      threadId: candidates[0].id,
      threadSubject: `${candidates.length} thread${candidates.length !== 1 ? "s" : ""}`,
      metadata: {
        threadIds: candidates.map((t) => t.id),
        threads: candidates,
      },
    });

    const next: AutoBundleState = { fired: true, undone: false, threads: candidates };
    saveAutoBundle(BRIEF_AUTO_ARCHIVE_T2_KEY(), next);
    setAutoArchiveT2Bundle(next);
  }, [revealed, archiveThread, pushUndoAction]);

  // ── Approve handler (PROPOSE-AND-CONFIRM — requires explicit tap) ─────────

  const approveNewsletterArchive = useCallback(() => {
    if (proposeArchiveCandidates.length === 0) return;
    proposeArchiveCandidates.forEach((t) => archiveThread(t.id, true));
    pushUndoAction({
      type: "batch_archive",
      threadId: proposeArchiveCandidates[0].id,
      threadSubject: `${proposeArchiveCandidates.length} newsletter${proposeArchiveCandidates.length !== 1 ? "s" : ""}`,
      metadata: {
        threadIds: proposeArchiveCandidates.map((t) => t.id),
        threads: proposeArchiveCandidates,
      },
    });
    saveProposalState(BRIEF_NEWSLETTER_PROPOSAL_KEY(), "approved");
    setNewsletterProposal("approved");
  }, [proposeArchiveCandidates, archiveThread, pushUndoAction]);

  // Inline undo for newsletter approval
  const undoNewsletterArchive = useCallback(() => {
    performUndo();
    saveProposalState(BRIEF_NEWSLETTER_PROPOSAL_KEY(), "pending");
    setNewsletterProposal("pending");
  }, [performUndo]);

  // ── Undo for auto-fire bundles (direct inverse — no performUndo dependency) ─

  const undoAutoStar = useCallback(() => {
    const bundle = loadAutoBundle(BRIEF_AUTO_STAR_KEY());
    if (!bundle.fired || bundle.undone) return;
    bundle.threads.forEach((t) => toggleStarred(t.id, true));
    const next = { ...bundle, undone: true };
    saveAutoBundle(BRIEF_AUTO_STAR_KEY(), next);
    setAutoStarBundle(next);
  }, [toggleStarred]);

  const undoAutoArchiveT2 = useCallback(() => {
    const bundle = loadAutoBundle(BRIEF_AUTO_ARCHIVE_T2_KEY());
    if (!bundle.fired || bundle.undone) return;
    bundle.threads.forEach((t) => unarchiveThread(t.id));
    const next = { ...bundle, undone: true };
    saveAutoBundle(BRIEF_AUTO_ARCHIVE_T2_KEY(), next);
    setAutoArchiveT2Bundle(next);
  }, [unarchiveThread]);

  // ── Bundle undo handler (SAFE bundles — visual only) ─────────────────────

  const undoBundle = useCallback(
    (bundleKey: string, bundleThreads: DiracThread[], label: string) => {
      pushUndoAction({
        type: "bundle",
        threadId: bundleThreads[0]?.id ?? "",
        threadSubject: label,
        metadata: {
          bundleKey,
          threadIds: bundleThreads.map((t) => t.id),
          label,
        },
      });
      // Optimistically remove from Handled immediately, and persist
      setUnbundledKeys((prev) => {
        const next = new Set([...prev, bundleKey]);
        saveUnbundledKeys(next);
        return next;
      });
    },
    [pushUndoAction],
  );

  // ── On-the-fly draft generation for drafted-tier cards ─────────────────

  // Track which threadIds we've already kicked off a draft for
  const draftInitiatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const plan of draftedCards) {
      if (draftInitiatedRef.current.has(plan.threadId)) continue;
      if (draftStates[plan.threadId]) continue;

      draftInitiatedRef.current.add(plan.threadId);

      const controller = new AbortController();
      draftAborts.current.set(plan.threadId, controller);

      setDraftStates((prev) => ({
        ...prev,
        [plan.threadId]: { loading: true, text: null, error: false },
      }));

      generateDraft(plan, toneProfile, controller.signal)
        .then((text) => {
          if (controller.signal.aborted) return;
          setDraftStates((prev) => ({
            ...prev,
            [plan.threadId]: {
              loading: false,
              text,
              error: text === null,
            },
          }));
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setDraftStates((prev) => ({
              ...prev,
              [plan.threadId]: { loading: false, text: null, error: true },
            }));
          }
        });
    }
  }, [draftedCards, toneProfile, draftStates]);

  // Abort all draft fetches on unmount
  useEffect(() => {
    const aborts = draftAborts.current;
    return () => {
      for (const ctrl of aborts.values()) ctrl.abort();
      enrichAbort.current?.abort();
    };
  }, []);

  // ── Action handlers (same logic as modal) ─────────────────────────────

  const detectPlanIntent = (
    planText: string,
  ): "compose" | "draft" | "neutral" => {
    const t = planText.toLowerCase();
    if (
      /\b(reply|respond|follow[\s-]?up on|answer|acknowledge)\b/.test(t)
    )
      return "draft";
    if (
      /\b(email|message|write to|reach out|introduce|loop in|cc|forward to|send (an? )?(email|note|message) to)\b/.test(
        t,
      )
    )
      return "compose";
    return "neutral";
  };

  const intentHint = (intent: "compose" | "draft" | "neutral") => {
    if (intent === "compose")
      return "\n\nNote: this plan calls for a NEW outbound email — produce a `compose` block, not a reply draft. Resolve the recipient from the contact directory.";
    if (intent === "draft")
      return "\n\nNote: this plan is a reply to the thread above — produce a `draft` block addressed to the existing participants.";
    return "";
  };

  const refreshDismissed = () => setDismissedThreads(loadDismissedThreads());

  const acceptPlan = useCallback(
    (plan: MorningPlanCard) => {
      const effectivePlan = plan.aiPlan ?? plan.plan;
      suppressThread(plan.threadId, 2);
      removePendingThread(plan.threadId);
      refreshDismissed();
      clearAiContext();
      addToAiContext({ id: plan.threadId, label: plan.subject });
      const hint = intentHint(detectPlanIntent(effectivePlan));
      setPendingAiQuery(
        `From this morning's briefing — thread "${plan.subject}" (${plan.sender}). Plan: ${effectivePlan}${hint}`,
      );
      setAiSidebarOpen(true);
      setSelectedThreadId(plan.threadId);
      // Navigate to /inbox so the AI sidebar (which only mounts there) picks up the pending query
      markNavFromBrief(); router.push("/inbox");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      clearAiContext,
      addToAiContext,
      setPendingAiQuery,
      setAiSidebarOpen,
      setSelectedThreadId,
      router,
    ],
  );

  const openWithAi = useCallback(
    (plan: MorningPlanCard) => {
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
      markNavFromBrief(); router.push("/inbox");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      clearAiContext,
      addToAiContext,
      setPendingAiQuery,
      setAiSidebarOpen,
      setSelectedThreadId,
      router,
    ],
  );

  const dismissPlan = (threadId: string) => {
    suppressThread(threadId, 3);
    removePendingThread(threadId);
    refreshDismissed();
    setPlans((prev) => prev.filter((p) => p.threadId !== threadId));
  };

  // ── Inline send for drafted-tier cards ────────────────────────────────────
  // Only called when a complete draft already exists. Routes through the shared
  // sendThreadReply extracted from the AI sidebar — no new infrastructure.

  const sendDraft = useCallback(
    async (plan: MorningPlanCard, draftText: string) => {
      if (!draftText.trim()) return;
      const { threadId } = plan;

      setSendingIds((prev) => new Set([...prev, threadId]));

      const result = await sendThreadReply(threadId, draftText);

      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(threadId);
        return next;
      });

      if (result.ok) {
        setSentIds((prev) => new Set([...prev, threadId]));
        toast({
          title: "Reply sent",
          description: `"${plan.subject}"`,
          variant: "success",
        });
        // Remove from brief after a brief moment so user sees the success state
        setTimeout(() => {
          suppressThread(threadId, 2);
          removePendingThread(threadId);
          refreshDismissed();
          setPlans((prev) => prev.filter((p) => p.threadId !== threadId));
        }, 900);
      } else {
        toast({
          title: "Send failed",
          description: result.error ?? "Could not send this reply.",
          variant: "error",
        });
      }
    },
    [sendThreadReply, toast],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  const totalNeedYou = decisionCards.length + draftedCards.length;
  const isLoading = threadsLoading || triageLoading || categoryLoading;
  const skeletonCount = Math.min(3, settings.maxItems);

  const grainBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Paper grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundImage: grainBg, opacity: 0.035 }}
      />

      {/* Page header */}
      <div className="relative z-10 border-b border-white/8 px-6 py-5">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-[22px] font-semibold text-white/92 leading-none tracking-tight">
            Morning Brief
          </h1>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase select-none">
            {isLoading
              ? "Loading…"
              : `${totalNeedYou} need${totalNeedYou === 1 ? "s" : ""} you · ${handledCount} grouped`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {isLoading || !revealed ? (
            <motion.div
              key="skeletons"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
              <p className="text-[15px] font-medium text-white/70">
                Inbox clear
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-white/25">
                Nothing outstanding today
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="sections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* ── Needs a decision ─────────────────────────────── */}
              {decisionCards.length > 0 && (
                <div>
                  <SectionHeader
                    label="Needs a decision"
                    count={decisionCards.length}
                  />
                  <div className="flex flex-col gap-2.5">
                    <AnimatePresence>
                      {decisionCards.map((plan, idx) => {
                        const isEditing = editingId === plan.threadId;
                        return (
                          <PlanCardContent
                            key={plan.threadId}
                            plan={plan}
                            index={idx}
                            isEditing={isEditing}
                            onEdit={() =>
                              setEditingId(isEditing ? null : plan.threadId)
                            }
                            onAccept={() => acceptPlan(plan)}
                            onOpenWithAi={() => openWithAi(plan)}
                            onOpenThread={() => {
                              setSelectedThreadId(plan.threadId);
                              markNavFromBrief(); router.push("/inbox");
                            }}
                            onDismiss={() => dismissPlan(plan.threadId)}
                            onPlanChange={(val) =>
                              setPlans((prev) =>
                                prev.map((p) => {
                                  if (p.threadId !== plan.threadId) return p;
                                  return p.aiPlan !== undefined
                                    ? { ...p, aiPlan: val }
                                    : { ...p, plan: val };
                                }),
                              )
                            }
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* ── Drafted, ready to send ───────────────────────── */}
              {draftedCards.length > 0 && (
                <div>
                  <SectionHeader
                    label="Drafted, ready to send"
                    count={draftedCards.length}
                  />
                  <div className="flex flex-col gap-2.5">
                    <AnimatePresence>
                      {draftedCards.map((plan, idx) => {
                        const ds = draftStates[plan.threadId];
                        const isEditing = editingId === plan.threadId;

                        if (!ds || ds.loading) {
                          return (
                            <PlanCardSkeleton key={plan.threadId} index={idx} />
                          );
                        }

                        // If draft generation failed, fall back to standard card
                        const planWithDraft: MorningPlanCard =
                          ds.text
                            ? { ...plan, aiPlan: ds.text }
                            : plan;

                        return (
                          <DraftedCard
                            key={plan.threadId}
                            plan={planWithDraft}
                            index={idx}
                            isEditing={isEditing}
                            onEdit={() =>
                              setEditingId(isEditing ? null : plan.threadId)
                            }
                            onAccept={() => acceptPlan(plan)}
                            onOpenWithAi={() => openWithAi(plan)}
                            onOpenThread={() => {
                              setSelectedThreadId(plan.threadId);
                              markNavFromBrief(); router.push("/inbox");
                            }}
                            onDismiss={() => dismissPlan(plan.threadId)}
                            onPlanChange={(val) =>
                              setPlans((prev) =>
                                prev.map((p) => {
                                  if (p.threadId !== plan.threadId) return p;
                                  return p.aiPlan !== undefined
                                    ? { ...p, aiPlan: val }
                                    : { ...p, plan: val };
                                }),
                              )
                            }
                            draftText={ds.text}
                            sending={sendingIds.has(plan.threadId)}
                            sent={sentIds.has(plan.threadId)}
                            onSend={(text) => sendDraft(plan, text)}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* ── Handled ──────────────────────────────────────── */}
              <HandledSection
                notificationBundles={notificationBundles}
                proposeArchiveCandidates={proposeArchiveCandidates}
                newsletterProposal={newsletterProposal}
                onApproveNewsletters={approveNewsletterArchive}
                onDismissNewsletters={() => {
                  saveProposalState(BRIEF_NEWSLETTER_PROPOSAL_KEY(), "dismissed");
                  setNewsletterProposal("dismissed");
                }}
                onUndoNewsletterArchive={undoNewsletterArchive}
                autoStarBundle={autoStarBundle}
                autoArchiveT2Bundle={autoArchiveT2Bundle}
                onUndoAutoStar={undoAutoStar}
                onUndoAutoArchiveT2={undoAutoArchiveT2}
                onUndoBundle={undoBundle}
                onViewAll={(ids) => {
                  openViewAll(ids);
                  markNavFromBrief(); router.push("/inbox");
                }}
                handledCount={handledCount}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── DraftedCard — wraps PlanCardContent and adds Send button + draft inline ─

function DraftedCard({
  plan,
  index,
  isEditing,
  onEdit,
  onAccept,
  onOpenWithAi,
  onOpenThread,
  onDismiss,
  onPlanChange,
  draftText,
  sending,
  sent,
  onSend,
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
  draftText: string | null;
  sending: boolean;
  sent: boolean;
  onSend: (text: string) => void;
}) {
  const [draftExpanded, setDraftExpanded] = useState(true);
  const [localDraft, setLocalDraft] = useState(draftText ?? "");

  // Sync if the generated draft arrives after mount (loading → ready transition)
  const prevDraftText = useRef(draftText);
  useEffect(() => {
    if (draftText && draftText !== prevDraftText.current) {
      setLocalDraft(draftText);
      prevDraftText.current = draftText;
    }
  }, [draftText]);

  // Auto-resize the textarea to fit its content
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [localDraft, draftExpanded]);

  return (
    <div className="flex flex-col gap-0">
      <PlanCardContent
        plan={plan}
        index={index}
        isEditing={isEditing}
        onEdit={onEdit}
        onAccept={onAccept}
        onOpenWithAi={onOpenWithAi}
        onOpenThread={onOpenThread}
        onDismiss={onDismiss}
        onPlanChange={onPlanChange}
      />
      {draftText && (
        <div className="rounded-b-lg border border-t-0 border-white/8 bg-black/60 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              onClick={() => setDraftExpanded((v) => !v)}
              className="flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase text-white/35 hover:text-white/60 transition-colors"
            >
              {draftExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Draft
            </button>
            {sent ? (
              <span className="font-mono text-[10px] text-emerald-400/70 tracking-[0.08em]">
                Sent
              </span>
            ) : (
              <button
                onClick={() => onSend(localDraft)}
                disabled={sending || !localDraft.trim()}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors",
                  sending || !localDraft.trim()
                    ? "bg-emerald-500/8 text-emerald-300/40 border border-emerald-500/10 cursor-not-allowed"
                    : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/20",
                )}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            )}
          </div>
          {draftExpanded && (
            <textarea
              ref={textareaRef}
              value={localDraft}
              onChange={(e) => setLocalDraft(e.target.value)}
              disabled={sending || sent}
              rows={1}
              className={cn(
                "w-full resize-none overflow-hidden rounded bg-transparent font-mono text-[11px] leading-[1.7] text-white/55 placeholder-white/20",
                "border border-white/0 hover:border-white/8 focus:border-white/12 focus:outline-none focus:text-white/70",
                "transition-colors px-1.5 py-1 -mx-1.5",
                (sending || sent) && "cursor-default opacity-60",
              )}
              placeholder="Draft text…"
            />
          )}
        </div>
      )}
    </div>
  );
}
