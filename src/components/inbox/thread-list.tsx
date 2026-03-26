"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRef, useCallback } from "react";
import {
  Mail,
  MessageSquare,
  Star,
  AlertTriangle,
  Clock,
  Inbox,
  PenSquare,
  Archive,
  Trash2,
  MailOpen,
  MailX,
  BrainCircuit,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { DiracThread, InboxFilter, FounderCategory, TriageCategory } from "@/lib/types";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  TRIAGE_LABELS,
} from "@/lib/types";

const FILTER_TABS: { value: InboxFilter; label: string }[] = [
  { value: "needs_reply", label: "Needs me" },
  { value: "waiting_on", label: "Waiting" },
  { value: "urgent", label: "Urgent" },
  { value: "unread", label: "Unread" },
  { value: "all", label: "All" },
];

// ─── Individual thread row ───────────────────────────────

function ThreadRow({
  thread,
  isSelected,
  isBulkSelected,
  onSelect,
  compact,
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
  compact: boolean;
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
    trashThread,
    toggleAiContext,
    isInAiContext,
    setAiSidebarOpen,
    addToAiContext,
    setPendingAiQuery,
    topicMap,
    snoozedThreads,
  } = useAppState();

  const sender = thread.participants[0]?.name ?? thread.participants[0]?.email ?? "Unknown";
  const isSnoozed = snoozedThreads.some((s) => s.threadId === thread.id);
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false });
  const hasBulk = isBulkSelected && bulkThreads.length > 1;
  const targets = hasBulk ? bulkThreads : [thread];

  const triageLabel = triage ? TRIAGE_LABELS[triage] : thread.isUnread ? "Needs review" : "No action";
  const statusTone = isDone
    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
    : isSnoozed
      ? "text-amber-700 dark:text-amber-400 bg-amber-500/10"
      : triage === "needs_reply"
        ? "text-blue-700 dark:text-blue-400 bg-blue-500/10"
        : triage === "waiting_on"
          ? "text-violet-700 dark:text-violet-400 bg-violet-500/10"
          : triage === "automated"
            ? "text-slate-600 dark:text-slate-400 bg-slate-500/10"
            : "text-muted-foreground bg-muted";

  const statusLabel = isDone
    ? "Done"
    : isSnoozed
      ? "Snoozed"
      : triageLabel;

  const secondaryBadge = thread.isUrgent
    ? "Urgent"
    : commitmentCount > 0
      ? `${commitmentCount} commit${commitmentCount !== 1 ? "s" : ""}`
      : null;

  const summaryLine = thread.snippet ?? "";

  const allBadges: { label: string; color: string }[] = [];
  if (category) {
    allBadges.push({ label: FOUNDER_CATEGORY_LABELS[category], color: FOUNDER_CATEGORY_COLORS[category] });
  }
  allBadges.push({ label: statusLabel, color: statusTone });
  if (secondaryBadge) {
    allBadges.push({
      label: secondaryBadge,
      color: thread.isUrgent
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    });
  }

  const cardPy = compact ? "py-2.5" : "py-3";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "group relative flex border-b border-border px-4 text-left transition-colors w-full",
            cardPy,
            isSelected ? "bg-accent/60" : "hover:bg-accent/30",
            isBulkSelected ? "bg-primary/5" : "",
          )}
        >
          {isSelected && <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />}

          {/* Left: sender, subject, snippet */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 min-w-0">
              {thread.platform === "DISCORD" ? (
                <MessageSquare className="h-4 w-4 shrink-0 text-indigo-500" />
              ) : thread.platform === "OUTLOOK" ? (
                <Mail className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              <span className={cn(
                "min-w-0 truncate text-sm leading-5",
                thread.isUnread ? "font-semibold text-foreground" : "text-foreground",
              )}>
                {sender}
              </span>
            </div>

            <p className={cn(
              "truncate text-[13px] leading-5",
              thread.isUnread ? "font-medium text-foreground" : "text-muted-foreground",
            )}>
              {thread.subject}
            </p>

            <p className="truncate text-xs leading-5 text-muted-foreground/70">
              {summaryLine}
            </p>
          </div>

          {/* Right: star+time row, then stacked badges */}
          <div className="flex flex-col items-end gap-1 shrink-0 pl-3 pt-px">
            <div className="flex items-center gap-1.5">
              {isSnoozed && <Clock className="h-3 w-3 text-amber-500" />}
              <div
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); toggleStarred(thread.id); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleStarred(thread.id); }}}
                className={cn(
                  "rounded p-0.5 transition-opacity cursor-pointer",
                  thread.isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <Star className={cn(
                  "h-3 w-3 transition-colors",
                  thread.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400",
                )} />
              </div>
              <span className="text-xs leading-none text-muted-foreground whitespace-nowrap">{timeAgo}</span>
            </div>

            {allBadges.slice(0, 3).map((b, i) => (
              <span
                key={i}
                className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap", b.color)}
              >
                {b.label}
              </span>
            ))}
          </div>

          {thread.isUnread && (
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {hasBulk && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {targets.length} threads selected
            </div>
            <ContextMenuSeparator />
          </>
        )}

        <ContextMenuItem
          onClick={() => {
            for (const t of targets) {
              addToAiContext({ id: t.id, label: t.subject });
            }
            const subjects = targets.map(t => `"${t.subject}"`).join(", ");
            setPendingAiQuery(
              targets.length === 1
                ? `Summarize the thread ${subjects} — key points, action items, and what needs a response.`
                : `Summarize these ${targets.length} threads: ${subjects}. For each, give key points, action items, and what needs a response.`
            );
            setAiSidebarOpen(true);
          }}
        >
          <FileText className="h-4 w-4" />
          Summarize{hasBulk ? ` ${targets.length} threads` : ""}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => targets.forEach(t => toggleStarred(t.id))}>
          <Star className={cn("h-4 w-4", !hasBulk && thread.isStarred && "fill-yellow-400 text-yellow-400")} />
          {!hasBulk && thread.isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => markThreadRead(t.id))}>
          <MailOpen className="h-4 w-4" /> Mark as read
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => markThreadUnread(t.id))}>
          <MailX className="h-4 w-4" /> Mark as unread
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => toggleUrgent(t.id))}>
          <AlertTriangle className={cn("h-4 w-4", !hasBulk && thread.isUrgent && "text-red-500")} />
          {!hasBulk && thread.isUrgent ? "Remove urgent" : "Mark as urgent"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => targets.forEach(t => toggleAiContext({ id: t.id, label: t.subject }))}>
          <BrainCircuit className="h-4 w-4" />
          Add to AI context
        </ContextMenuItem>

        {targets.every(t => t.platform !== "DISCORD") && (
          <ContextMenuItem variant="destructive" onClick={() => targets.forEach(t => trashThread(t.id))}>
            <Trash2 className="h-4 w-4" /> Delete{hasBulk ? ` ${targets.length} threads` : ""}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Bulk actions toolbar ────────────────────────────────

function BulkToolbar({
  count,
  onMarkRead,
  onArchive,
  onTrash,
  onClear,
}: {
  count: number;
  onMarkRead: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-accent/40 px-2 py-1.5">
      <span className="text-[11px] font-medium text-foreground mr-auto shrink-0">
        {count} selected
      </span>
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

export function ThreadList() {
  const {
    threads,
    threadsLoading,
    selectedThreadId,
    setSelectedThreadId,
    inboxFilter,
    setInboxFilter,
    setComposeOpen,
    setComposeMinimized,
    triageMap,
    searchQuery,
    density,
    selectedThreadIds,
    selectAll,
    clearSelection,
    markThreadRead,
    archiveThread,
    trashThread,
    commitments,
    categoryMap,
    doneThreads,
    snoozedThreads,
  } = useAppState();

  const lastClickedIdxRef = useRef<number | null>(null);

  // Apply filter + search
  const filtered = threads.filter(t => {
    const triage = triageMap[t.id];
    const isDone = doneThreads.has(t.id);
    const isSnoozed = snoozedThreads.some((s) => s.threadId === t.id);

    const matchesFilter =
      inboxFilter === "needs_reply" ? triage === "needs_reply" && !isDone && !isSnoozed :
      inboxFilter === "unread" ? t.isUnread :
      inboxFilter === "starred" ? t.isStarred :
      inboxFilter === "urgent" ? t.isUrgent :
      inboxFilter === "waiting_on" ? triage === "waiting_on" && !isDone :
      inboxFilter === "snoozed" ? isSnoozed :
      inboxFilter === "done" ? isDone :
      true;

    if (!matchesFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.participants.some(p =>
          p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
        )
      );
    }

    return true;
  });

  const needsReplyCount = threads.filter(t => triageMap[t.id] === "needs_reply" && !doneThreads.has(t.id)).length;
  const urgentCount    = threads.filter(t => t.isUrgent).length;
  const unreadCount    = threads.filter(t => t.isUnread).length;
  const waitingCount   = threads.filter(t => triageMap[t.id] === "waiting_on" && !doneThreads.has(t.id)).length;
  const bulkCount      = selectedThreadIds.size;
  const compact        = density === "compact";
  const bulkThreads    = threads.filter(t => selectedThreadIds.has(t.id));

  // Shift-click range select
  const handleSelect = useCallback((idx: number, threadId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      const from = Math.min(lastClickedIdxRef.current, idx);
      const to   = Math.max(lastClickedIdxRef.current, idx);
      const idsInRange = filtered.slice(from, to + 1).map(t => t.id);
      selectAll(idsInRange);
    } else {
      setSelectedThreadId(threadId);
      clearSelection();
    }
    lastClickedIdxRef.current = idx;
  }, [filtered, selectAll, setSelectedThreadId, clearSelection]);

  const handleBulkMarkRead = () => {
    selectedThreadIds.forEach(id => markThreadRead(id));
    clearSelection();
  };
  const handleBulkArchive = () => {
    selectedThreadIds.forEach(id => archiveThread(id));
    clearSelection();
  };
  const handleBulkTrash = () => {
    selectedThreadIds.forEach(id => trashThread(id));
    clearSelection();
  };

  return (
    <div className="flex h-full w-80 flex-col border-r border-border">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground">Inbox</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} thread{filtered.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
              title="Compose"
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent/60 transition-colors"
            >
              <PenSquare className="h-3.5 w-3.5" />
              Compose
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 border-b border-border px-2 py-1.5 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map(f => (
          <button
            key={f.value}
            onClick={() => setInboxFilter(f.value)}
            className={cn(
              "relative whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors shrink-0",
              inboxFilter === f.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {f.label}
            {f.value === "needs_reply" && needsReplyCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                {needsReplyCount}
              </span>
            )}
            {f.value === "unread" && unreadCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/80 px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
            {f.value === "urgent" && urgentCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {urgentCount}
              </span>
            )}
            {f.value === "waiting_on" && waitingCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk toolbar */}
      {bulkCount > 0 && (
        <BulkToolbar
          count={bulkCount}
          onMarkRead={handleBulkMarkRead}
          onArchive={handleBulkArchive}
          onTrash={handleBulkTrash}
          onClear={clearSelection}
        />
      )}

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {threadsLoading && threads.length === 0 ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-border px-4 py-3 animate-pulse">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded bg-muted" />
                    <div className="h-3 rounded bg-muted" style={{ width: `${60 + (i * 17) % 60}px` }} />
                  </div>
                  <div className="h-3 w-10 rounded bg-muted" />
                </div>
                <div className="h-3 rounded bg-muted" style={{ width: `${120 + (i * 31) % 100}px` }} />
                <div className="h-3 w-full rounded bg-muted opacity-50" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No accounts connected</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Connect Gmail or Outlook to get started</p>
              </div>
              <Button size="sm" asChild>
                <Link href="/settings">Connect an account →</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {inboxFilter === "starred"    ? "No starred threads"             :
                 inboxFilter === "urgent"     ? "No urgent threads"              :
                 inboxFilter === "waiting_on" ? "Nothing waiting on a response"  :
                                               "No threads match this filter"   }
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col">
            {filtered.map((thread, idx) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                triage={triageMap[thread.id]}
                category={categoryMap[thread.id]}
                commitmentCount={commitments.filter((c) => c.threadId === thread.id).length}
                isDone={doneThreads.has(thread.id)}
                isSelected={thread.id === selectedThreadId}
                isBulkSelected={selectedThreadIds.has(thread.id)}
                compact={compact}
                bulkThreads={bulkThreads}
                onSelect={(e) => handleSelect(idx, thread.id, e)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
