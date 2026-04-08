"use client";

import { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Mail, MessageSquare, Star, ChevronDown, ChevronRight, Loader2, Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  TOPIC_TAG_LABELS,
  TOPIC_TAG_COLORS,
  TRIAGE_LABELS,
} from "@/lib/types";
import type { DiracThread, DiracMessage, TopicTag, FounderCategory, TriageCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickActions } from "@/components/inbox/thread-view";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ExpandedThread({ thread, defaultExpanded = true }: { thread: DiracThread; defaultExpanded?: boolean }) {
  const {
    triageMap, categoryMap, topicMap, toggleStarred, doneThreads, snoozedThreads,
    addToAiContext, setPendingAiQuery, setAiSidebarOpen,
  } = useAppState();

  const [expanded, setExpanded]   = useState(defaultExpanded);
  const [messages, setMessages]   = useState<DiracMessage[]>([]);
  const [loading, setLoading]     = useState(false);
  const fetchedRef                = useRef(false);

  const triage    = triageMap[thread.id] as TriageCategory | undefined;
  const category  = categoryMap[thread.id] as FounderCategory | undefined;
  const topics: TopicTag[] = topicMap[thread.id] ?? [];
  const isDone    = doneThreads.has(thread.id);
  const isSnoozed = snoozedThreads.some((s) => s.threadId === thread.id);
  const sender    = thread.participants[0]?.name ?? thread.participants[0]?.email ?? "Unknown";

  const borderAccent =
    thread.isUrgent          ? "border-l-rose-500"   :
    triage === "needs_reply" ? "border-l-sky-500"    :
    triage === "waiting_on"  ? "border-l-indigo-400" :
    "border-l-transparent";

  // Fetch messages on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    const apiUrl =
      thread.platform === "DISCORD"
        ? `/api/discord/threads/${thread.id}`
        : thread.platform === "OUTLOOK"
          ? `/api/outlook/threads/${thread.id}`
          : `/api/gmail/threads/${thread.id}`;
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [thread.id, thread.platform]);

  return (
    <div className={cn("rounded-2xl border border-border bg-background shadow-sm border-l-4 overflow-hidden", borderAccent)}>
      {/* ── Thread header (always visible, click row to collapse) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
        className="group flex w-full cursor-pointer items-start gap-3 px-5 py-4 text-left hover:bg-accent/15 transition-colors select-none"
      >
        {expanded
          ? <ChevronDown  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform" />
          : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform" />
        }

        {thread.platform === "DISCORD"
          ? <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          : <Mail           className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-[13px] font-semibold truncate", thread.isUnread ? "text-foreground" : "text-foreground/80")}>
              {sender}
            </span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground/50">
              {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
            </span>
          </div>
          <p className={cn("mt-0.5 text-sm truncate", thread.isUnread ? "font-medium text-foreground" : "text-muted-foreground")}>
            {thread.subject}
          </p>
          {!expanded && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/50">{thread.snippet ?? ""}</p>
          )}

          {/* Badges */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {category && (
              <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium", FOUNDER_CATEGORY_COLORS[category])}>
                <span className="opacity-40">@</span>{FOUNDER_CATEGORY_LABELS[category]}
              </span>
            )}
            {topics[0] && (
              <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium", TOPIC_TAG_COLORS[topics[0]])}>
                <span className="opacity-40">#</span>{TOPIC_TAG_LABELS[topics[0]]}
              </span>
            )}
            {thread.isUrgent && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-rose-500/8 text-rose-600/80">Urgent</span>
            )}
            {!thread.isUrgent && (triage === "needs_reply" || triage === "waiting_on") && (
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                triage === "needs_reply" ? "bg-sky-500/8 text-sky-600/80" : "bg-indigo-500/8 text-indigo-500/80",
              )}>
                {TRIAGE_LABELS[triage]}
              </span>
            )}
            {isDone    && <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-500/8 text-teal-600/80">Done</span>}
            {isSnoozed && <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/8 text-amber-600/80">Snoozed</span>}
          </div>
        </div>

        {/* Star — must be a button, sits inside the div row not a nested button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleStarred(thread.id); }}
          className={cn("mt-0.5 shrink-0 rounded p-1 transition-opacity", thread.isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-60")}
        >
          <Star className={cn("h-4 w-4", thread.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
        </button>
      </div>

      {/* ── Expanded: messages + quick actions ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <Separator />

            {/* Messages */}
            <div className="flex flex-col gap-0 px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages found</p>
              ) : (
                messages.map((msg, idx) => (
                  <div key={msg.id}>
                    <div className="flex gap-3 py-4">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">{getInitials(msg.fromName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{msg.fromName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {thread.platform !== "DISCORD" && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            to {msg.toAddresses.length > 0 ? msg.toAddresses.join(", ") : "..."}
                          </p>
                        )}
                        {msg.bodyHtml ? (
                          <div
                            className="mt-3 prose prose-sm max-w-none text-foreground prose-a:text-primary [&_img]:max-w-full"
                            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                          />
                        ) : (
                          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {msg.bodyText || "(no content)"}
                          </div>
                        )}
                      </div>
                    </div>
                    {idx < messages.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </div>

            {/* Quick actions — same as ThreadView */}
            <QuickActions
              threadId={thread.id}
              threadSubject={thread.subject}
              platform={thread.platform}
              participants={thread.participants}
              category={category}
              triage={triage}
              onSendToAi={(prompt) => {
                addToAiContext({ id: thread.id, label: thread.subject });
                setPendingAiQuery(prompt);
                setAiSidebarOpen(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Not an overlay — rendered inline as the main content area, AI sidebar stays visible on the right. */
export function ViewAllView() {
  const { viewAllThreadIds, closeViewAll, threads } = useAppState();

  const viewAllThreads = viewAllThreadIds
    .map((id) => threads.find((t) => t.id === id))
    .filter(Boolean) as DiracThread[];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <button
          onClick={closeViewAll}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </button>
        <Separator orientation="vertical" className="h-4" />
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          View all
          <span className="ml-1.5 font-normal text-muted-foreground text-xs">
            {viewAllThreads.length} thread{viewAllThreads.length !== 1 ? "s" : ""}
          </span>
        </span>
      </div>

      {/* Scrollable thread list */}
      <ScrollArea className="flex-1">
        {viewAllThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Layers className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No threads selected</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-5">
            {viewAllThreads.map((thread, i) => (
              <ExpandedThread key={thread.id} thread={thread} defaultExpanded={i === 0} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/** Legacy named export — kept so app-shell.tsx import doesn't break; renders nothing since ViewAllView is now inline. */
export function ViewAllOverlay() {
  return null;
}
