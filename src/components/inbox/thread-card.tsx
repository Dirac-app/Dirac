"use client";

import { formatDistanceToNow } from "date-fns";
import React from "react";
import {
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
  MailOpen,
  MailX,
  BrainCircuit,
  Layers,
  Sunrise,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
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

export function ThreadCard({
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
    addToMorningBrief,
    isInMorningBrief,
    trashThread,
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

  type BadgeKind = "what" | "status";
  const allBadges: { label: string; color: string; kind: BadgeKind }[] = [];

  // Sender-type badge lives inline with the sender name (not in the bottom badge row)
  const categoryBadge = category
    ? { label: FOUNDER_CATEGORY_LABELS[category], color: FOUNDER_CATEGORY_COLORS[category] }
    : null;

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
          data-thread-card
          className={cn(
            "group relative flex w-full items-start gap-3 border-b border-border/40 px-4 md:px-5 py-3 md:py-3 touch-target text-left transition-all duration-150",
            isBulkSelected
              ? "bg-primary/8"
              : isSelected
                ? "bg-accent/50 thread-selected"
                : "hover:bg-accent/25",
          )}
        >
          {/* Avatar */}
          <div className="relative mt-1 shrink-0">
            {isBulkSelected ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            ) : (
              <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold leading-none select-none",
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
            {/* Row 1: sender + category + status dot + message count | time + star */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "truncate text-[13px] leading-5 shrink min-w-0",
                thread.isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
              )}>
                {sender}
              </span>
              {categoryBadge && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-serif italic text-[11px] leading-snug whitespace-nowrap",
                    categoryBadge.color,
                  )}
                >
                  <span className="opacity-40 not-italic font-sans">@</span>
                  {categoryBadge.label}
                </span>
              )}
              {statusDot && (
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
              )}
              {thread.platform === "DISCORD" && (
                <MessageSquare className="h-3 w-3 shrink-0 text-indigo-500/60" />
              )}
              {thread.messageCount > 1 && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
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
              "text-[13.5px] leading-normal line-clamp-1",
              thread.isUnread ? "font-medium text-foreground" : "font-normal text-foreground/70",
            )}>
              {thread.subject}
            </p>

            {/* Row 3: snippet */}
            <p className="line-clamp-1 text-[12px] leading-normal text-muted-foreground/55">
              {thread.snippet ?? ""}
            </p>

            {/* Row 4: badges — topic + status only (@ sender badge is inline with sender name) */}
            {allBadges.length > 0 && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {allBadges.slice(0, 4).map((b, i) => (
                  <span
                    key={i}
                    data-badge={b.kind === "status" ? b.label.toLowerCase().replace(/\s+/g, "-") : undefined}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-medium leading-snug whitespace-nowrap",
                      b.color,
                    )}
                  >
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
        <ContextMenuItem
          onClick={() => {
            addToMorningBrief(targets.map((t) => t.id));
            clearSelection();
          }}
          disabled={targets.every((t) => isInMorningBrief(t.id))}
        >
          <Sunrise className="h-4 w-4" />
          {hasBulk
            ? targets.every((t) => isInMorningBrief(t.id))
              ? "All in morning brief"
              : `Add ${targets.length} to morning brief`
            : isInMorningBrief(thread.id)
              ? "In morning brief"
              : "Add to morning brief"}
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
