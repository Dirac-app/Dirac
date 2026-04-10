"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { format, addHours, nextMonday, setHours, setMinutes, setSeconds } from "date-fns";
import {
  Bookmark,
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  MessageSquare,
  Reply,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Zap,
  Mail,
  AlertTriangle,
  X,
  PenLine,
  BookOpen,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  type SnoozeState,
  type DiracThread,
  type RelationshipContext,
  type FounderCategory,
  type TriageCategory,
} from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import type { ToneProfile } from "@/lib/store";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadView() {
  const {
    selectedThreadId,
    setSelectedThreadId,
    threads,
    messages,
    messagesLoading,
    isInAiContext,
    addToAiContext,
    removeFromAiContext,
    setAiSidebarOpen,
    setPendingAiQuery,
    toggleStarred,
    markDone,
    unmarkDone,
    doneThreads,
    archiveThread,
    snoozeThread,
    snoozedThreads,
    commitments,
    categoryMap,
    triageMap,
    toneProfile,
    getRelationshipContext,
    addClip,
  } = useAppState();

  // ── Clip selection popup ──────────────────────────────
  const [clipPopup, setClipPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const clipPopupRef  = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const onMouseUp = () => {
      // Small delay lets the browser finalise the Selection object after mouseup
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
        const text = sel.toString().trim();
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        savedRangeRef.current = range.cloneRange(); // persist range before React re-render clears it
        setClipPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
      }, 60);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (clipPopupRef.current && !clipPopupRef.current.contains(e.target as Node)) {
        savedRangeRef.current = null;
        setClipPopup(null);
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // Re-apply saved selection synchronously before paint — keeps the blue highlight visible
  useLayoutEffect(() => {
    if (clipPopup && savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  }, [clipPopup]);

  // Escape → back to inbox
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setSelectedThreadId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelectedThreadId]);

  if (!selectedThreadId) return null;

  const thread = threads.find((t) => t.id === selectedThreadId);
  if (!thread) return null;

  const handleClip = () => {
    if (!clipPopup) return;
    const isUrl = /^https?:\/\//i.test(clipPopup.text);
    addClip({
      threadId: thread.id,
      threadSubject: thread.subject,
      content: clipPopup.text,
      type: isUrl ? "link" : "quote",
    });
    savedRangeRef.current = null;
    window.getSelection()?.removeAllRanges();
    setClipPopup(null);
  };

  const isDiscord = thread.platform === "DISCORD";
  const inContext = isInAiContext(thread.id);
  const isDone = doneThreads.has(thread.id);
  const threadCommitments = commitments.filter((c) => c.threadId === thread.id);
  const category = categoryMap[thread.id];
  const triage = triageMap[thread.id] as TriageCategory | undefined;
  const snoozeState = snoozedThreads.find((s) => s.threadId === thread.id);

  const handleToggleContext = () => {
    if (inContext) {
      removeFromAiContext(thread.id);
    } else {
      addToAiContext({ id: thread.id, label: thread.subject });
      setAiSidebarOpen(true);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Thread header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button */}
            <button
              onClick={() => setSelectedThreadId(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
              title="Back to inbox (Esc)"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Inbox
            </button>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isDiscord && (
                  <MessageSquare className="h-4 w-4 shrink-0 text-indigo-500" />
                )}
                <h2 className="truncate text-base font-semibold text-foreground">
                  {thread.subject}
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {thread.participants.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>

          {/* Thread actions */}
          <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={inContext ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleContext}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {inContext ? "Remove from AI context" : "Add to AI context"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleStarred(thread.id)}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    thread.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {thread.isStarred ? "Unstar" : "Star"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => isDone ? unmarkDone(thread.id) : markDone(thread.id)}
              >
                <CheckCircle2
                  className={cn("h-4 w-4", isDone && "text-green-500")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDone ? "Move to inbox" : "Mark done"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => archiveThread(thread.id)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>

          <SnoozeButton threadId={thread.id} onSnooze={snoozeThread} />
        </div>
      </div>
      </div>

      {/* Snooze banner */}
      {snoozeState && snoozeState.until && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Snoozed until {format(new Date(snoozeState.until), "EEE, MMM d 'at' h:mm a")}
        </div>
      )}

      {/* Commitments banner */}
      {threadCommitments.length > 0 && (
        <div className="border-b border-border bg-amber-500/5 px-6 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {threadCommitments.length} commitment{threadCommitments.length !== 1 ? "s" : ""}
          </div>
          <div className="mt-1 space-y-1">
            {threadCommitments.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  c.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  c.owner === "me" ? "bg-blue-500" : "bg-amber-500",
                )} />
                <span className="flex-1">{c.description}</span>
                {c.dueDate && (
                  <span className="shrink-0 font-medium">
                    {c.isOverdue ? "Overdue" : format(new Date(c.dueDate), "MMM d")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sender profile (collapsible) */}
      <SenderProfile
        thread={thread}
        threads={threads}
        toneProfile={toneProfile}
        getRelationshipContext={getRelationshipContext}
      />

      {/* Clip popup — appears above selected text, stays until dismissed */}
      {clipPopup && (
        <div
          ref={clipPopupRef}
          className="pointer-events-auto fixed z-50 flex items-center rounded-lg border border-border bg-background shadow-xl px-1.5 py-1 -translate-x-1/2 -translate-y-full"
          style={{ left: clipPopup.x, top: clipPopup.y }}
          onMouseDown={e => e.preventDefault()}
        >
          <button
            onClick={handleClip}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Bookmark className="h-3 w-3 text-primary" />
            Clip
          </button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0 px-6 py-4">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No messages found in this thread
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id}>
                <div className="flex gap-3 py-4">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {getInitials(msg.fromName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {msg.fromName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {!isDiscord && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        to{" "}
                        {msg.toAddresses.length > 0
                          ? msg.toAddresses.join(", ")
                          : "..."}
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
      </ScrollArea>

      {/* Quick actions bar */}
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
    </div>
  );
}

// ─── Sender Profile ──────────────────────────────────────

function SenderProfile({
  thread,
  threads,
  toneProfile,
  getRelationshipContext,
}: {
  thread: DiracThread;
  threads: DiracThread[];
  toneProfile: ToneProfile | null;
  getRelationshipContext: (email: string) => RelationshipContext | null;
}) {
  const [open, setOpen] = useState(false);

  const sender = thread.participants[0];
  if (!sender || thread.platform === "DISCORD") return null;

  const relationshipCtx = getRelationshipContext(sender.email);
  const threadCount = threads.filter((t) =>
    t.participants.some((p) => p.email === sender.email),
  ).length;

  // Find matching conditional tone for this sender
  const matchingTone = toneProfile?.conditional_tones?.find((ct) => {
    const email = sender.email.toLowerCase();
    if (ct.context === "client_customer" && (email.includes("customer") || email.includes("client"))) return true;
    if (ct.context === "internal_team" && email.includes("team")) return true;
    return false;
  });

  const lastContacted = relationshipCtx?.lastContacted
    ? format(new Date(relationshipCtx.lastContacted), "MMM d, yyyy")
    : null;

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-6 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/30"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium text-foreground">{sender.name || sender.email}</span>
        <span className="text-muted-foreground">&lt;{sender.email}&gt;</span>
        {!open && threadCount > 0 && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {threadCount} thread{threadCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-6 pb-3 pt-1 text-xs">
          <div>
            <span className="text-muted-foreground">Threads: </span>
            <span className="font-medium text-foreground">{threadCount}</span>
          </div>
          {lastContacted && (
            <div>
              <span className="text-muted-foreground">Last contacted: </span>
              <span className="font-medium text-foreground">{lastContacted}</span>
            </div>
          )}
          {matchingTone && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Tone used: </span>
              <span className="font-medium text-foreground capitalize">{matchingTone.formality} · {matchingTone.tone}</span>
            </div>
          )}
          {toneProfile && !matchingTone && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Tone used: </span>
              <span className="font-medium text-foreground capitalize">{toneProfile.formality}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Snooze Button ───────────────────────────────────────

function SnoozeButton({
  threadId,
  onSnooze,
}: {
  threadId: string;
  onSnooze: (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">) => void;
}) {
  const [open, setOpen] = useState(false);

  function snoozeUntil(date: Date, label: string) {
    onSnooze(threadId, { mode: "time", until: date.toISOString(), condition: label });
    setOpen(false);
  }

  const options = [
    {
      label: "Later today",
      description: "+3 hours",
      getDate: () => addHours(new Date(), 3),
    },
    {
      label: "Tomorrow morning",
      description: "9 am tomorrow",
      getDate: () => {
        const d = addHours(new Date(), 24);
        return setSeconds(setMinutes(setHours(d, 9), 0), 0);
      },
    },
    {
      label: "Next week",
      description: "Monday 9 am",
      getDate: () => {
        const monday = nextMonday(new Date());
        return setSeconds(setMinutes(setHours(monday, 9), 0), 0);
      },
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Snooze</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-52 p-1" align="end">
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Snooze until…
        </p>
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => snoozeUntil(opt.getDate(), opt.label)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
          >
            <span>{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.description}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Quick AI Actions ────────────────────────────────────

interface DraftOption {
  id: string;
  label: string;
  body: string;
}

export function QuickActions({
  threadId,
  threadSubject,
  platform,
  participants,
  onSendToAi,
  triage,
  category,
}: {
  threadId: string;
  threadSubject: string;
  platform: string;
  participants: { name: string; email: string }[];
  onSendToAi: (prompt: string) => void;
  triage?: TriageCategory;
  category?: FounderCategory;
}) {
  const { toneProfile } = useAppState();
  const { toast } = useToast();

  // Draft-with-AI widget
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [editingBody, setEditingBody] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // Manual reply composer
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBody, setManualBody] = useState("");
  const [manualSending, setManualSending] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const cachedContextRef = useRef<{ from: string; body: string; sentAt: string }[] | null>(null);

  const fetchThreadContext = async () => {
    if (cachedContextRef.current) return cachedContextRef.current;
    const isOutlook = platform === "OUTLOOK";
    const url = isOutlook ? `/api/outlook/threads/${threadId}` : `/api/gmail/threads/${threadId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const ctx = (data.messages ?? []).map(
      (m: { fromName: string; bodyText: string; sentAt: string }) => ({
        from: m.fromName,
        body: m.bodyText,
        sentAt: m.sentAt,
      }),
    );
    cachedContextRef.current = ctx;
    return ctx;
  };

  const handleDraftWithAi = async () => {
    if (draftOpen && draftOptions.length > 0) {
      setDraftOpen(false);
      return;
    }
    setDraftOpen(true);
    setManualOpen(false);
    setDraftOptions([]);
    setDraftLoading(true);
    setError(null);
    try {
      const messages = await fetchThreadContext();
      const res = await fetch("/api/ai/quick-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionLabel: `Reply to this email${triage === "waiting_on" ? " (follow-up nudge)" : ""}${category ? ` (${category} thread)` : ""}`,
          threadSubject,
          messages: messages ?? [],
          toneProfile: toneProfile ?? undefined,
          preset: localStorage.getItem("dirac-ai-preset") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const options: DraftOption[] = data.options ?? [];
      setDraftOptions(options);
      setEditingBody(Object.fromEntries(options.map((o) => [o.id, o.body])));
    } catch {
      setError("Couldn't generate drafts.");
      setDraftOpen(false);
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendOption = async (option: DraftOption) => {
    const body = editingBody[option.id] ?? option.body;
    setSending(option.id);
    setError(null);
    try {
      const isOutlook = platform === "OUTLOOK";
      const recipient = participants[0];
      const sendUrl = isOutlook ? "/api/outlook/send" : "/api/gmail/send";
      const payload = isOutlook
        ? { to: recipient?.email ?? "", subject: threadSubject, body }
        : { threadId, to: recipient?.email ?? "", subject: threadSubject, body };
      const res = await fetch(sendUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Send failed");
      setSent(option.id);
      toast({ title: "Reply sent", description: option.label, variant: "success" });
      setTimeout(() => { setSent(null); setDraftOpen(false); setDraftOptions([]); }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      toast({ title: "Reply failed", description: msg, variant: "error" });
    } finally {
      setSending(null);
    }
  };

  const handleManualSend = async () => {
    if (!manualBody.trim()) return;
    setManualSending(true);
    setError(null);
    try {
      const isOutlook = platform === "OUTLOOK";
      const recipient = participants[0];
      const sendUrl = isOutlook ? "/api/outlook/send" : "/api/gmail/send";
      const payload = isOutlook
        ? { to: recipient?.email ?? "", subject: threadSubject, body: manualBody.trim() }
        : { threadId, to: recipient?.email ?? "", subject: threadSubject, body: manualBody.trim() };
      const res = await fetch(sendUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Send failed");
      toast({ title: "Reply sent", variant: "success" });
      setManualBody("");
      setManualOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      toast({ title: "Reply failed", description: msg, variant: "error" });
    } finally {
      setManualSending(false);
    }
  };

  const handleAiAssist = async () => {
    setAiRewriting(true);
    try {
      const messages = await fetchThreadContext();
      const prompt = manualBody.trim()
        ? `Improve and polish this draft reply, keeping the same intent:\n\n${manualBody}`
        : `Draft a concise reply to the thread "${threadSubject}" in my tone.`;
      const context = messages
        ? [{ threadId, subject: threadSubject, messages: messages.map((m: { from: string; body: string; sentAt: string }) => ({ from: m.from, body: m.body, sentAt: m.sentAt })) }]
        : undefined;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, context, toneProfile: toneProfile ?? undefined, preset: localStorage.getItem("dirac-ai-preset") || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const match = accumulated.match(/```draft\n([\s\S]*?)```/);
        setManualBody(match ? match[1].trim() : accumulated.replace(/```[\w]*\n?/g, "").trim());
      }
    } catch {
      // silently fall back
    } finally {
      setAiRewriting(false);
    }
  };

  return (
    <div className="border-t border-border px-6 py-3">
      {/* Header */}
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Recommended actions
      </p>

      {/* 3 fixed buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className={cn("h-8 gap-1.5 px-3 text-xs", draftOpen && "ring-1 ring-primary/40")}
          onClick={handleDraftWithAi}
          disabled={draftLoading}
        >
          {draftLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Draft with AI
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => onSendToAi(`Summarize the thread "${threadSubject}" — key points, action items, and what I should do next.`)}
        >
          <BookOpen className="h-3 w-3" />
          Summarize
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 px-3 text-xs", manualOpen && "ring-1 ring-primary/30")}
          onClick={() => { setManualOpen((v) => !v); setDraftOpen(false); }}
        >
          <PenLine className="h-3 w-3" />
          Manual reply
        </Button>

        {error && <span className="ml-auto text-xs text-red-500/70">{error}</span>}
      </div>

      {/* ── Draft-with-AI options widget ── */}
      <AnimatePresence>
        {draftOpen && (
          <motion.div
            key="draft-options"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  Pick a draft
                </p>
                <button
                  onClick={() => { setDraftOpen(false); setDraftOptions([]); }}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Loading */}
              {draftLoading && (
                <div className="space-y-2 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border border-border/40 bg-background px-3 py-2.5 space-y-1.5">
                      <div className="h-2.5 w-20 rounded bg-muted/60" />
                      <div className="h-2.5 w-full rounded bg-muted/45" />
                      <div className="h-2.5 w-4/5 rounded bg-muted/35" />
                    </div>
                  ))}
                </div>
              )}

              {/* Options */}
              {!draftLoading && draftOptions.length > 0 && (
                <div className="space-y-2">
                  {draftOptions.map((option, idx) => {
                    const isEditing = editingId === option.id;
                    const isSending = sending === option.id;
                    const isSent = sent === option.id;
                    const currentBody = editingBody[option.id] ?? option.body;
                    return (
                      <motion.div
                        key={option.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: idx * 0.06 }}
                        className="rounded-lg border border-border/40 bg-background px-3 py-2.5 hover:border-border/70 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11.5px] font-medium text-foreground/80">{option.label}</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingId(isEditing ? null : option.id)}
                              title={isEditing ? "Done editing" : "Edit"}
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                                isEditing ? "text-primary" : "text-foreground/60 hover:text-foreground"
                              )}
                            >
                              <PenLine className="h-2.5 w-2.5" />
                            </button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] gap-1"
                              onClick={() => handleSendOption(option)}
                              disabled={!!sending}
                            >
                              {isSending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : isSent ? <Check className="h-2.5 w-2.5 text-teal-500" /> : <Send className="h-2.5 w-2.5" />}
                              {isSent ? "Sent" : "Send"}
                            </Button>
                          </div>
                        </div>
                        {isEditing ? (
                          <textarea
                            value={currentBody}
                            onChange={(e) => setEditingBody((prev) => ({ ...prev, [option.id]: e.target.value }))}
                            className="w-full resize-none rounded-md border border-border bg-muted/20 px-2.5 py-2 text-[12px] leading-[1.6] text-foreground/80 outline-none focus:ring-1 focus:ring-ring min-h-[80px]"
                            autoFocus
                          />
                        ) : (
                          <p className="text-[12px] leading-[1.55] text-muted-foreground/80">{currentBody}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manual reply composer ── */}
      <AnimatePresence>
        {manualOpen && (
          <motion.div
            key="manual-reply"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
              {/* Composer header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground min-w-0">
                  <span className="shrink-0 font-medium">To</span>
                  <span className="truncate text-foreground/80">
                    {participants[0]?.name || participants[0]?.email || "—"}
                    {participants[0]?.email && participants[0]?.name ? ` <${participants[0].email}>` : ""}
                  </span>
                </div>
                <button
                  onClick={() => { setManualOpen(false); setManualBody(""); }}
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Body textarea */}
              <textarea
                value={manualBody}
                onChange={(e) => setManualBody(e.target.value)}
                placeholder="Write your reply…"
                className="w-full resize-none bg-transparent px-3 py-3 text-[13px] leading-[1.65] text-foreground placeholder:text-muted-foreground/40 outline-none min-h-[130px]"
                autoFocus={manualOpen}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleManualSend();
                }}
              />

              {/* Footer toolbar */}
              <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={handleManualSend}
                  disabled={!manualBody.trim() || manualSending}
                >
                  {manualSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={handleAiAssist}
                  disabled={aiRewriting}
                >
                  {aiRewriting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {manualBody.trim() ? "AI rewrite" : "Draft with AI"}
                </Button>

                <span className="ml-auto text-[10px] text-muted-foreground/40">
                  ⌘↵ to send
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

