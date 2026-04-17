"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRef, useCallback, useState, useEffect } from "react";
import {
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Archive,
  Trash2,
  MailOpen,
  MailX,
  BrainCircuit,
  X,
  Search,
  ChevronDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountsEmptyState, SearchEmptyState } from "@/components/ui/empty-state";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { DiracThread, FounderCategory, TriageCategory, TopicTag } from "@/lib/types";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  TRIAGE_LABELS,
  TOPIC_TAG_LABELS,
  TOPIC_TAG_COLORS,
} from "@/lib/types";

// Muted avatar palette — low-saturation, soft tones
const AVATAR_COLORS = [
  "bg-stone-200 text-stone-500 dark:bg-stone-700/60 dark:text-stone-300",
  "bg-slate-200 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300",
  "bg-zinc-200 text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-300",
  "bg-neutral-200 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-300",
  "bg-gray-200 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300",
  "bg-stone-300/60 text-stone-600 dark:bg-stone-600/50 dark:text-stone-200",
  "bg-slate-300/60 text-slate-600 dark:bg-slate-600/50 dark:text-slate-200",
  "bg-zinc-300/60 text-zinc-600 dark:bg-zinc-600/50 dark:text-zinc-200",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Individual thread card ──────────────────────────────

function ThreadCard({
  thread,
  isSelected,
  isBulkSelected,
  onSelect,
  bulkThreads,
  triage,
  category,
  commitmentCount,
  isDone,
}: {
  thread: DiracThread;
  isSelected: boolean;
  isBulkSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  bulkThreads: DiracThread[];
  triage?: TriageCategory;
  category?: FounderCategory;
  commitmentCount: number;
  isDone: boolean;
}) {
  const {
    toggleStarred,
    toggleUrgent,
    markThreadUnread,
    markThreadRead,
    markDone,
    archiveThread,
    addToSetAside,
    trashThread,
    toggleAiContext,
    setAiSidebarOpen,
    addToAiContext,
    setPendingAiQuery,
    topicMap,
    snoozedThreads,
    doneThreads,
    clearSelection,
  } = useAppState();

  const sender = thread.participants[0]?.name ?? thread.participants[0]?.email ?? "Unknown";
  const isSnoozed = snoozedThreads.some((s) => s.threadId === thread.id);
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false });
  const hasBulk = isBulkSelected && bulkThreads.length > 1;
  const targets = hasBulk ? bulkThreads : [thread];

  const topics: TopicTag[] = topicMap[thread.id] ?? [];
  const topicBadge = topics.find(
    (t) => !(t === "personal" && (category === "personal" || category === "automated")),
  ) ?? topics[0] ?? null;

  type BadgeKind = "who" | "what" | "status";
  const allBadges: { label: string; color: string; kind: BadgeKind }[] = [];

  if (category) {
    allBadges.push({ label: FOUNDER_CATEGORY_LABELS[category], color: FOUNDER_CATEGORY_COLORS[category], kind: "who" });
  }
  if (topicBadge) {
    allBadges.push({ label: TOPIC_TAG_LABELS[topicBadge], color: TOPIC_TAG_COLORS[topicBadge], kind: "what" });
  }
  if (thread.isUrgent) {
    allBadges.push({ label: "Urgent", color: "bg-rose-500/12 dark:bg-rose-400/15 text-rose-600 dark:text-rose-300", kind: "status" });
  } else if (commitmentCount > 0) {
    allBadges.push({
      label: `${commitmentCount} commit${commitmentCount !== 1 ? "s" : ""}`,
      color: "bg-amber-500/12 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300",
      kind: "status",
    });
  }
  if (!thread.isUrgent && (triage === "needs_reply" || triage === "waiting_on")) {
    const triageColors: Record<string, string> = {
      needs_reply: "text-sky-600 dark:text-sky-300 bg-sky-500/12 dark:bg-sky-400/15",
      waiting_on:  "text-indigo-600 dark:text-indigo-300 bg-indigo-500/12 dark:bg-indigo-400/15",
    };
    allBadges.push({ label: TRIAGE_LABELS[triage], color: triageColors[triage], kind: "status" });
  }
  if (isDone) {
    allBadges.push({ label: "Done", color: "text-teal-600 dark:text-teal-300 bg-teal-500/12 dark:bg-teal-400/15", kind: "status" });
  } else if (isSnoozed) {
    allBadges.push({ label: "Snoozed", color: "text-amber-600 dark:text-amber-300 bg-amber-500/12 dark:bg-amber-400/15", kind: "status" });
  }

  const avatarColor = AVATAR_COLORS[hashString(sender) % AVATAR_COLORS.length];
  const initials = getInitials(sender);

  // Status dot color for the sender row — communicates urgency at a glance
  const statusDot =
    thread.isUrgent         ? "bg-rose-500"   :
    triage === "needs_reply" ? "bg-sky-500"   :
    triage === "waiting_on"  ? "bg-indigo-400" :
    null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "group relative flex w-full items-start gap-3 border-b border-border/40 px-5 py-3.5 text-left transition-all duration-150",
            isBulkSelected
              ? "bg-primary/6"
              : isSelected
                ? "bg-accent/50"
                : "hover:bg-accent/25",
          )}
        >
          {/* Avatar */}
          <div className="relative mt-0.5 shrink-0">
            {isBulkSelected ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            ) : (
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold leading-none select-none",
                avatarColor,
              )}>
                {initials}
              </span>
            )}
            {/* Unread indicator — dot on the avatar */}
            {thread.isUnread && !isBulkSelected && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* Row 1: sender + status dot + message count | time + star */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "truncate text-[13px] leading-5",
                thread.isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
              )}>
                {sender}
              </span>
              {statusDot && (
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
              )}
              {thread.platform === "DISCORD" && (
                <MessageSquare className="h-3 w-3 shrink-0 text-indigo-500/60" />
              )}
              {thread.messageCount > 1 && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                  {thread.messageCount}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {isSnoozed && <Clock className="h-3 w-3 text-amber-500/70" />}
                <span className="text-[11px] text-muted-foreground/40 whitespace-nowrap tabular-nums">{timeAgo}</span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); toggleStarred(thread.id); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleStarred(thread.id); }}}
                  className={cn(
                    "rounded p-0.5 transition-opacity cursor-pointer",
                    thread.isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                  )}
                >
                  <Star className={cn(
                    "h-3 w-3 transition-colors",
                    thread.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/60 hover:text-yellow-400",
                  )} />
                </div>
              </div>
            </div>

            {/* Row 2: subject */}
            <p className={cn(
              "text-[13.5px] leading-snug line-clamp-1",
              thread.isUnread ? "font-medium text-foreground" : "font-normal text-foreground/65",
            )}>
              {thread.subject}
            </p>

            {/* Row 3: snippet */}
            <p className="line-clamp-1 text-[12px] leading-relaxed text-muted-foreground/45">
              {thread.snippet ?? ""}
            </p>

            {/* Row 4: badges — compact inline */}
            {allBadges.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {allBadges.slice(0, 4).map((b, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium leading-snug whitespace-nowrap",
                      b.kind === "who" ? "rounded-full" : "rounded",
                      b.color,
                    )}
                  >
                    {b.kind === "who"  && <span className="opacity-40 font-normal">@</span>}
                    {b.kind === "what" && <span className="opacity-40 font-normal">#</span>}
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {/* Selection header when multi-selected */}
        {hasBulk && (
          <>
            <ContextMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
              {targets.length} threads selected
            </ContextMenuLabel>
            <ContextMenuSeparator />
          </>
        )}

        {/* ── Read / star / urgent ── */}
        <ContextMenuItem onClick={() => targets.forEach(t => toggleStarred(t.id))}>
          <Star className={cn("h-4 w-4", !hasBulk && thread.isStarred && "fill-yellow-400 text-yellow-400")} />
          {!hasBulk && thread.isStarred ? "Unstar" : hasBulk ? "Star all" : "Star"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => targets.forEach(t => markThreadRead(t.id))}>
          <MailOpen className="h-4 w-4" />
          {hasBulk ? "Mark all as read" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => targets.forEach(t => markThreadUnread(t.id))}>
          <MailX className="h-4 w-4" />
          {hasBulk ? "Mark all as unread" : "Mark as unread"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { targets.forEach(t => toggleUrgent(t.id)); }}>
          <AlertTriangle className={cn("h-4 w-4", !hasBulk && thread.isUrgent && "text-rose-500")} />
          {!hasBulk && thread.isUrgent ? "Remove urgent" : hasBulk ? "Mark all urgent" : "Mark as urgent"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { targets.forEach(t => markDone(t.id)); clearSelection(); }}>
          <CheckCircle2 className={cn("h-4 w-4", !hasBulk && doneThreads.has(thread.id) && "text-teal-500")} />
          {hasBulk ? "Mark all done" : "Mark as done"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* ── Triage ── */}
        <ContextMenuItem onClick={() => { addToSetAside(targets.map(t => t.id)); clearSelection(); }}>
          <Layers className="h-4 w-4" />
          {hasBulk ? `Set ${targets.length} aside` : "Set aside"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { targets.forEach(t => archiveThread(t.id)); clearSelection(); }}>
          <Archive className="h-4 w-4" />
          {hasBulk ? `Archive ${targets.length}` : "Archive"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* ── AI actions ── */}
        <ContextMenuItem onClick={() => {
          targets.forEach(t => addToAiContext({ id: t.id, label: t.subject }));
          setAiSidebarOpen(true);
        }}>
          <BrainCircuit className="h-4 w-4" />
          {hasBulk ? `Add ${targets.length} to AI context` : "Add to AI context"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          targets.forEach(t => addToAiContext({ id: t.id, label: t.subject }));
          setAiSidebarOpen(true);
          setPendingAiQuery(
            hasBulk
              ? `I've added ${targets.length} threads to context. Summarize them and tell me what needs my attention.`
              : `Summarize this thread: "${thread.subject}"`,
          );
        }}>
          <BrainCircuit className="h-4 w-4 text-primary" />
          {hasBulk ? "Ask AI about all" : "Ask AI about this"}
        </ContextMenuItem>

        {/* ── Destructive ── */}
        {targets.every(t => t.platform !== "DISCORD") && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => { targets.forEach(t => trashThread(t.id)); clearSelection(); }}>
              <Trash2 className="h-4 w-4" />
              {hasBulk ? `Delete ${targets.length} threads` : "Delete"}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Section header ──────────────────────────────────────

function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
  accent,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="group flex w-full items-center gap-2.5 border-b border-border/40 bg-muted/20 px-5 py-2.5 text-left hover:bg-muted/35 transition-colors"
    >
      <ChevronDown className={cn(
        "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150",
        collapsed && "-rotate-90",
      )} />
      <span className={cn("text-[12px] font-bold uppercase tracking-wide", accent ?? "text-foreground/60")}>
        {label}
      </span>
      {count > 0 && (
        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Bulk actions toolbar ────────────────────────────────

function BulkToolbar({
  count,
  onMarkRead,
  onArchive,
  onTrash,
  onSetAside,
  onViewAll,
  onClear,
}: {
  count: number;
  onMarkRead: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onSetAside: () => void;
  onViewAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-accent/40 px-3 py-1.5">
      <span className="text-[11px] font-medium text-foreground mr-auto shrink-0">
        {count} selected
      </span>
      <button
        onClick={onViewAll}
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Layers className="h-3 w-3" />
        View all
      </button>
      <button
        onClick={onSetAside}
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Layers className="h-3 w-3" />
        Set aside
      </button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onMarkRead} title="Mark as read">
        <MailOpen className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onArchive} title="Archive">
        <Archive className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-600 hover:text-red-600" onClick={onTrash} title="Delete">
        <Trash2 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClear} title="Clear selection">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Main ThreadList ─────────────────────────────────────

// Extra section definitions the user can enable
export type ExtraSection = "urgent" | "waiting_on" | "needs_reply" | "done" | "snoozed";
export const EXTRA_SECTION_LABELS: Record<ExtraSection, string> = {
  urgent:      "Urgent",
  waiting_on:  "Waiting on",
  needs_reply: "Needs reply",
  done:        "Done",
  snoozed:     "Snoozed",
};
export const EXTRA_SECTION_ACCENTS: Record<ExtraSection, string> = {
  urgent:      "text-rose-600 dark:text-rose-400",
  waiting_on:  "text-indigo-600 dark:text-indigo-400",
  needs_reply: "text-sky-600 dark:text-sky-400",
  done:        "text-teal-600 dark:text-teal-400",
  snoozed:     "text-amber-600 dark:text-amber-400",
};
const SECTIONS_LS_KEY = "dirac-inbox-sections";
const DEFAULT_SECTIONS: ExtraSection[] = ["urgent"];

export function ThreadList() {
  const {
    threads,
    threadsLoading,
    selectedThreadId,
    setSelectedThreadId,
    triageMap,
    searchQuery,
    setSearchQuery,
    density: _density,
    selectedThreadIds,
    toggleBulkSelect,
    clearSelection,
    markThreadRead,
    archiveThread,
    trashThread,
    commitments,
    categoryMap,
    doneThreads,
    snoozedThreads,
    addToSetAside,
    openViewAll,
    categoryTabMap,
    categoryTabs,
    activeTab,
    setActiveTab,
  } = useAppState();

  const lastClickedIdxRef = useRef<number | null>(null);
  const [newCollapsed, setNewCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [extraCollapsed, setExtraCollapsed] = useState<Record<string, boolean>>({});

  // Load user-configured extra sections from localStorage
  const [extraSections, setExtraSections] = useState<ExtraSection[]>(DEFAULT_SECTIONS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_LS_KEY);
      if (saved) setExtraSections(JSON.parse(saved));
    } catch {}
  }, []);

  const visibleTabs = categoryTabs
    .filter(t => t.visible)
    .sort((a, b) => a.order - b.order);

  const matchesTab = useCallback((t: DiracThread) => {
    if (activeTab === "all") return true;
    return categoryTabMap[t.id] === activeTab;
  }, [activeTab, categoryTabMap]);

  const matchesSearch = useCallback((t: DiracThread) => {
    if (!matchesTab(t)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      (t.snippet ?? "").toLowerCase().includes(q) ||
      t.participants.some(p =>
        p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, matchesTab]);

  // "New for you" = strictly unread, not done, not snoozed
  const newForYou = threads.filter(t => {
    const isDone = doneThreads.has(t.id);
    const isSnoozed = snoozedThreads.some(s => s.threadId === t.id);
    return t.isUnread && !isDone && !isSnoozed && matchesSearch(t);
  });

  // Extra sections: each has its own predicate, de-duplicated from newForYou
  const newIds = new Set(newForYou.map(t => t.id));
  const usedIds = new Set(newIds);

  const extraSectionThreads = extraSections.map(section => {
    const sectionThreads = threads.filter(t => {
      if (usedIds.has(t.id)) return false;
      if (!matchesSearch(t)) return false;
      const triage = triageMap[t.id];
      const isDone = doneThreads.has(t.id);
      const isSnoozed = snoozedThreads.some(s => s.threadId === t.id);
      switch (section) {
        case "urgent":      return t.isUrgent && !isDone;
        case "waiting_on":  return triage === "waiting_on" && !isDone;
        case "needs_reply": return triage === "needs_reply" && !isDone && !isSnoozed;
        case "done":        return isDone;
        case "snoozed":     return isSnoozed;
        default:            return false;
      }
    });
    sectionThreads.forEach(t => usedIds.add(t.id));
    return { section, threads: sectionThreads };
  });

  // "All" — everything not already shown
  const all = threads.filter(t => !usedIds.has(t.id) && matchesSearch(t));

  const allVisible = [...newForYou, ...extraSectionThreads.flatMap(s => s.threads), ...all];
  const bulkCount   = selectedThreadIds.size;
  const bulkThreads = threads.filter(t => selectedThreadIds.has(t.id));

  const handleSelect = useCallback((idx: number, threadId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+click → toggle just this thread in/out of the selection (no range)
      e.preventDefault();
      toggleBulkSelect(threadId);
      lastClickedIdxRef.current = idx;
    } else {
      // Normal click → open thread, clear any selection
      setSelectedThreadId(threadId);
      clearSelection();
      lastClickedIdxRef.current = idx;
    }
  }, [toggleBulkSelect, setSelectedThreadId, clearSelection]);

  const handleBulkMarkRead = () => { selectedThreadIds.forEach(id => markThreadRead(id)); clearSelection(); };
  const handleBulkArchive  = () => { selectedThreadIds.forEach(id => archiveThread(id));  clearSelection(); };
  const handleBulkTrash    = () => { selectedThreadIds.forEach(id => trashThread(id));    clearSelection(); };
  const handleSetAside     = () => { addToSetAside([...selectedThreadIds]); clearSelection(); };
  const handleViewAll      = () => { openViewAll([...selectedThreadIds]); clearSelection(); };

  const renderSection = (sectionThreads: DiracThread[], baseIdx: number) =>
    sectionThreads.map((thread, i) => (
      <ThreadCard
        key={thread.id}
        thread={thread}
        triage={triageMap[thread.id]}
        category={categoryMap[thread.id]}
        commitmentCount={commitments.filter(c => c.threadId === thread.id).length}
        isDone={doneThreads.has(thread.id)}
        isSelected={thread.id === selectedThreadId}
        isBulkSelected={selectedThreadIds.has(thread.id)}
        bulkThreads={bulkThreads}
        onSelect={e => handleSelect(baseIdx + i, thread.id, e)}
      />
    ));

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-border/60 px-6 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-4">Inbox</h1>
        {/* Search */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/25 px-3.5 py-2.5 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search threads…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {visibleTabs.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-5 py-1.5 scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-all",
              activeTab === "all"
                ? "bg-foreground text-background"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40",
            )}
          >
            All
          </button>
          {visibleTabs.map(tab => {
            const count = threads.filter(t => categoryTabMap[t.id] === tab.id).length;
            if (count === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(activeTab === tab.id ? "all" : tab.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40",
                )}
              >
                {tab.label}
                <span className="ml-1 text-[10px] opacity-60 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk toolbar */}
      {bulkCount > 0 && (
        <BulkToolbar
          count={bulkCount}
          onMarkRead={handleBulkMarkRead}
          onArchive={handleBulkArchive}
          onTrash={handleBulkTrash}
          onSetAside={handleSetAside}
          onViewAll={handleViewAll}
          onClear={clearSelection}
        />
      )}

      {/* Sections */}
      <ScrollArea className="flex-1">
        {threadsLoading && threads.length === 0 ? (
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-border/40 px-5 py-3.5 animate-pulse">
                <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3 rounded bg-muted" style={{ width: `${80 + (i * 23) % 80}px` }} />
                    <div className="h-3 w-10 rounded bg-muted" />
                  </div>
                  <div className="h-3 rounded bg-muted" style={{ width: `${140 + (i * 31) % 120}px` }} />
                  <div className="h-3 w-full rounded bg-muted opacity-40" />
                </div>
              </div>
            ))}
          </div>
        ) : allVisible.length === 0 && threads.length === 0 ? (
          <AccountsEmptyState />
        ) : allVisible.length === 0 ? (
          <SearchEmptyState />
        ) : (
          <div className="flex flex-col">
            {/* New for you — unread only */}
            {newForYou.length > 0 && (
              <>
                <SectionHeader
                  label="New for you"
                  count={newForYou.length}
                  collapsed={newCollapsed}
                  onToggle={() => setNewCollapsed(v => !v)}
                  accent="text-foreground/80"
                />
                {!newCollapsed && renderSection(newForYou, 0)}
              </>
            )}

            {/* User-configured extra sections */}
            {extraSectionThreads.map(({ section, threads: sThreads }, si) => {
              if (sThreads.length === 0) return null;
              const baseIdx = newForYou.length + extraSectionThreads.slice(0, si).reduce((a, s) => a + s.threads.length, 0);
              const isCollapsed = extraCollapsed[section] ?? false;
              return (
                <div key={section}>
                  <SectionHeader
                    label={EXTRA_SECTION_LABELS[section]}
                    count={sThreads.length}
                    collapsed={isCollapsed}
                    onToggle={() => setExtraCollapsed(prev => ({ ...prev, [section]: !prev[section] }))}
                    accent={EXTRA_SECTION_ACCENTS[section]}
                  />
                  {!isCollapsed && renderSection(sThreads, baseIdx)}
                </div>
              );
            })}

            {/* Previously seen — everything else */}
            {all.length > 0 && (
              <>
                <SectionHeader
                  label="Previously seen"
                  count={all.length}
                  collapsed={allCollapsed}
                  onToggle={() => setAllCollapsed(v => !v)}
                />
                {!allCollapsed && renderSection(all, allVisible.length - all.length)}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
