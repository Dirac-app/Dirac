"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  X,
  Search,
  ChevronDown,
  Layers,
  Archive,
  MailOpen,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AccountsEmptyState, SearchEmptyState } from "@/components/ui/empty-state";
import { ThreadListSkeleton } from "@/components/ui/skeleton";
import type { DiracThread } from "@/lib/types";
import { ThreadCard } from "./thread-card";

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

// ─── Types for virtualized list ──────────────────────────

type VirtualItem = 
  | { type: "header"; section: "new" | "extra" | "all"; label: string; count: number; collapsed: boolean; onToggle: () => void; accent?: string }
  | { type: "thread"; thread: DiracThread; index: number }
  | { type: "load-more" };

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
    loadMoreThreads,
    loadingMoreThreads,
    hasMoreThreads,
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
  const parentRef = useRef<HTMLDivElement>(null);
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

  const visibleTabs = [
    { id: "all", label: "All", visible: true, order: -1 },
    ...categoryTabs.filter(t => t.visible).sort((a, b) => a.order - b.order),
  ];

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
  const newForYou = useMemo(() => threads.filter(t => {
    const isDone = doneThreads.has(t.id);
    const isSnoozed = snoozedThreads.some(s => s.threadId === t.id);
    return t.isUnread && !isDone && !isSnoozed && matchesSearch(t);
  }), [threads, doneThreads, snoozedThreads, matchesSearch]);

  // Extra sections: each has its own predicate, de-duplicated from newForYou
  const extraSectionThreads = useMemo(() => {
    const newIds = new Set(newForYou.map(t => t.id));
    const usedIds = new Set(newIds);

    return extraSections.map(section => {
      const sectionThreads = threads.filter(t => {
        if (usedIds.has(t.id)) return false;
        if (!matchesSearch(t)) return false;
        const triage = triageMap[t.id];
        const isDone = doneThreads.has(t.id);
        const isSnoozed = snoozedThreads.some(s => s.threadId === t.id);
        let predicate = false;
        switch (section) {
          case "urgent":       predicate = t.isUrgent; break;
          case "waiting_on":  predicate = triage === "waiting_on" && !isDone; break;
          case "needs_reply": predicate = triage === "needs_reply" && !isDone; break;
          case "done":       predicate = isDone && !isSnoozed; break;
          case "snoozed":    predicate = isSnoozed; break;
        }
        return predicate;
      });
      sectionThreads.forEach(t => usedIds.add(t.id));
      return { section, threads: sectionThreads };
    });
  }, [threads, extraSections, newForYou, matchesSearch, triageMap, doneThreads, snoozedThreads]);

  // Old threads (read, not in extra sections) + any unread that's been snoozed or done
  const allOtherThreads = useMemo(() => {
    const extraIds = new Set(extraSectionThreads.flatMap(s => s.threads.map(t => t.id)));
    return threads.filter(t => {
      const isDone = doneThreads.has(t.id);
      const isSnoozed = snoozedThreads.some(s => s.threadId === t.id);
      const inNew = newForYou.some(n => n.id === t.id);
      const isExtra = extraIds.has(t.id);
      return (!t.isUnread || isDone || isSnoozed) && !inNew && !isExtra && matchesSearch(t);
    });
  }, [threads, extraSectionThreads, allCollapsed, newForYou, matchesSearch, doneThreads, snoozedThreads]);

  const hasBulk = selectedThreadIds.size > 0;
  const bulkThreads = useMemo(() => 
    threads.filter(t => selectedThreadIds.has(t.id)),
    [threads, selectedThreadIds]
  );

  // Build virtual list: headers + threads for each section
  const flatList = useMemo(() => {
    const items: VirtualItem[] = [];

    // "New for you" section
    if (newForYou.length > 0) {
      items.push({
        type: "header",
        section: "new",
        label: "New for you",
        count: newForYou.length,
        collapsed: newCollapsed,
        onToggle: () => setNewCollapsed(!newCollapsed),
      });
      if (!newCollapsed) {
        newForYou.forEach((thread, i) => items.push({ type: "thread", thread, index: i }));
      }
    }

    // Extra sections
    extraSectionThreads.forEach(({ section, threads: sectionThreads }) => {
      if (sectionThreads.length === 0) return;
      items.push({
        type: "header",
        section: "extra",
        label: EXTRA_SECTION_LABELS[section],
        count: sectionThreads.length,
        collapsed: extraCollapsed[section] ?? false,
        onToggle: () => setExtraCollapsed(prev => ({ ...prev, [section]: !prev[section] })),
        accent: EXTRA_SECTION_ACCENTS[section],
      });
      if (!extraCollapsed[section]) {
        sectionThreads.forEach((thread, i) => items.push({ type: "thread", thread, index: i }));
      }
    });

    // "Previously seen" section (read threads)
    if (allOtherThreads.length > 0) {
      items.push({
        type: "header",
        section: "all",
        label: "Previously seen",
        count: allOtherThreads.length,
        collapsed: allCollapsed,
        onToggle: () => setAllCollapsed(!allCollapsed),
      });
      if (!allCollapsed) {
        allOtherThreads.forEach((thread, i) => items.push({ type: "thread", thread, index: i }));
      }
    }

    // Load more row (only when not collapsed + more pages available)
    if (!allCollapsed && hasMoreThreads) {
      items.push({ type: "load-more" });
    }

    return items;
  }, [newForYou, newCollapsed, extraSectionThreads, extraCollapsed, allOtherThreads, allCollapsed]);

  const rowVirtualizer = useVirtualizer({
    count: flatList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const item = flatList[i];
      if (item?.type === "header") return 38;
      if (item?.type === "load-more") return 52;
      return 80;
    },
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Selection logic
  const handleSelect = useCallback((index: number, threadId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      // Range select
      const start = Math.min(lastClickedIdxRef.current, index);
      const end = Math.max(lastClickedIdxRef.current, index);
      const rangeIds = flatList
        .slice(start, end + 1)
        .filter((item): item is Extract<VirtualItem, { type: "thread" }> => item.type === "thread")
        .map(item => item.thread.id);
      rangeIds.forEach(id => {
        if (!selectedThreadIds.has(id)) toggleBulkSelect(id);
      });
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle
      toggleBulkSelect(threadId);
    } else {
      // Single select
      clearSelection();
      setSelectedThreadId(threadId);
    }
    lastClickedIdxRef.current = index;
  }, [flatList, selectedThreadIds, toggleBulkSelect, clearSelection, setSelectedThreadId]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Search bar ── */}
      <div data-thread-list-search className="flex h-[49px] items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search threads..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="rounded p-0.5 hover:bg-accent">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Tabs (if more than 1 visible category) ── */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 border-b border-border px-3 py-2 overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-active={activeTab === tab.id ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "tab-active bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Bulk toolbar ── */}
      {hasBulk && (
        <BulkToolbar
          count={selectedThreadIds.size}
          onMarkRead={() => { bulkThreads.forEach(t => markThreadRead(t.id)); clearSelection(); }}
          onArchive={() => { bulkThreads.forEach(t => archiveThread(t.id)); clearSelection(); }}
          onTrash={() => { bulkThreads.forEach(t => trashThread(t.id)); clearSelection(); }}
          onSetAside={() => { addToSetAside(bulkThreads.map(t => t.id)); clearSelection(); }}
          onViewAll={() => { openViewAll(bulkThreads.map(t => t.id)); clearSelection(); }}
          onClear={() => clearSelection()}
        />
      )}

      {/* ── Thread list ── */}
      {threadsLoading ? (
        <ThreadListSkeleton />
      ) : threads.length === 0 ? (
        <AccountsEmptyState />
      ) : flatList.length === 0 ? (
        <SearchEmptyState />
      ) : (
        // ref must be on the actual scroll container so useVirtualizer can
        // measure it; wrapping in ScrollArea breaks this because the component
        // adds an extra div that becomes the real scroll container.
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto min-h-0 w-full"
        >
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualItem => {
              const item = flatList[virtualItem.index];
              if (!item) return null;

              if (item.type === "header") {
                return (
                  <div
                    key={`header-${item.section}`}
                    data-index={virtualItem.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <SectionHeader
                      label={item.label}
                      count={item.count}
                      collapsed={item.collapsed}
                      onToggle={item.onToggle}
                      accent={item.accent}
                    />
                  </div>
                );
              }

              if (item.type === "load-more") {
                return (
                  <div
                    key="load-more"
                    data-index={virtualItem.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="flex items-center justify-center py-3 px-5">
                      <button
                        onClick={loadMoreThreads}
                        disabled={loadingMoreThreads}
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {loadingMoreThreads
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
                          : "Load older emails"
                        }
                      </button>
                    </div>
                  </div>
                );
              }

              const { thread, index } = item;
              return (
                <div
                  key={thread.id}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ThreadCard
                    thread={thread}
                    triage={triageMap[thread.id]}
                    category={categoryMap[thread.id]}
                    commitmentCount={commitments.filter(c => c.threadId === thread.id).length}
                    isDone={doneThreads.has(thread.id)}
                    isSelected={thread.id === selectedThreadId}
                    isBulkSelected={selectedThreadIds.has(thread.id)}
                    bulkThreads={bulkThreads}
                    onSelect={e => handleSelect(index, thread.id, e)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
