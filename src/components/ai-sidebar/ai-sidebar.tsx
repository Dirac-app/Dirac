"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  Plus,
  Mail,
  MessageSquare,
  Check,
  Trash2,
  Eye,
  Loader2,
  Copy,
  CornerUpRight,
  PenSquare,
  Star,
  StarOff,
  Archive,
  MailOpen,
  MailX,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────

interface McqQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ComposeData {
  to: string;
  subject: string;
  body: string;
}

interface ActionItem {
  threadId: string;
  action: "star" | "unstar" | "mark_read" | "mark_unread" | "mark_urgent" | "remove_urgent" | "archive" | "trash";
  subject: string;
}

interface ResultItem {
  threadId: string;
  subject: string;
  from: string;
  reason: string;
}

interface ParsedSegment {
  type: "text" | "mcq" | "draft" | "compose" | "actions" | "results";
  content: string;
  mcq?: McqQuestion[];
  compose?: ComposeData;
  actions?: ActionItem[];
  results?: ResultItem[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string[];
  segments?: ParsedSegment[];
  mcqAnswered?: boolean;
}

// ─── Parsing helpers ────────────────────────────────────

function parseAiContent(raw: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const fenceRegex = /```(mcq|draft|compose|actions|results)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: "text", content: text });
    }

    const fenceType = match[1] as "mcq" | "draft" | "compose" | "actions" | "results";
    const fenceBody = match[2].trim();

    if (fenceType === "mcq") {
      try {
        const parsed = JSON.parse(fenceBody);
        segments.push({ type: "mcq", content: fenceBody, mcq: parsed });
      } catch {
        segments.push({ type: "text", content: fenceBody });
      }
    } else if (fenceType === "compose") {
      try {
        const parsed = JSON.parse(fenceBody);
        segments.push({ type: "compose", content: fenceBody, compose: parsed });
      } catch {
        segments.push({ type: "text", content: fenceBody });
      }
    } else if (fenceType === "actions") {
      try {
        const parsed = JSON.parse(fenceBody);
        segments.push({ type: "actions", content: fenceBody, actions: parsed });
      } catch {
        segments.push({ type: "text", content: fenceBody });
      }
    } else if (fenceType === "results") {
      try {
        const parsed = JSON.parse(fenceBody);
        segments.push({ type: "results", content: fenceBody, results: parsed });
      } catch {
        segments.push({ type: "text", content: fenceBody });
      }
    } else {
      segments.push({ type: "draft", content: fenceBody });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex).trim();
    if (text) segments.push({ type: "text", content: text });
  }

  if (segments.length === 0 && raw.trim()) {
    segments.push({ type: "text", content: raw.trim() });
  }

  return segments;
}

// ─── Component ──────────────────────────────────────────

export function AiSidebar() {
  const router = useRouter();
  const {
    aiSidebarOpen,
    setAiSidebarOpen,
    selectedThreadId,
    setSelectedThreadId,
    threads,
    aiContext,
    toggleAiContext,
    removeFromAiContext,
    toneProfile,
    toggleStarred,
    toggleUrgent,
    markThreadRead,
    markThreadUnread,
    archiveThread,
    trashThread,
    setComposeOpen,
    setComposeMinimized,
    pendingAiQuery,
    setPendingAiQuery,
  } = useAppState();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [sentDraft, setSentDraft] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close context picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setContextPickerOpen(false);
      }
    }
    if (contextPickerOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [contextPickerOpen]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ─── Pick up pending AI query from spotlight ───────────
  useEffect(() => {
    if (!pendingAiQuery || !aiSidebarOpen || isStreamingRef.current) return;

    const query = pendingAiQuery;
    setPendingAiQuery(null);

    // Build thread summaries as lightweight context for the AI
    const threadSummaries = threads.slice(0, 20).map((t) => ({
      threadId: t.id,
      subject: t.subject,
      messages: [
        {
          from: t.participants[0]?.name ?? "Unknown",
          body: t.snippet,
          sentAt: t.lastMessageAt,
        },
      ],
    }));

    const userMsg: ChatMessage = {
      role: "user",
      content: query,
    };

    setChatMessages((prev) => {
      const next = [...prev, userMsg, { role: "assistant" as const, content: "", segments: [] }];
      const insertIdx = next.length - 1;

      // Fire the streaming request
      (async () => {
        isStreamingRef.current = true;
        setIsStreaming(true);
        try {
          const res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: query,
              context: threadSummaries.length > 0 ? threadSummaries : undefined,
              toneProfile: toneProfile ?? undefined,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "AI request failed" }));
            setChatMessages((prev2) => {
              const updated = [...prev2];
              updated[insertIdx] = {
                role: "assistant",
                content: err.error || "Something went wrong.",
                segments: [{ type: "text", content: err.error || "Something went wrong." }],
              };
              return updated;
            });
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let accumulated = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            const current = accumulated;
            setChatMessages((prev2) => {
              const updated = [...prev2];
              updated[insertIdx] = {
                role: "assistant",
                content: current,
                segments: parseAiContent(current),
              };
              return updated;
            });
          }
          setChatMessages((prev2) => {
            const updated = [...prev2];
            updated[insertIdx] = {
              role: "assistant",
              content: accumulated,
              segments: parseAiContent(accumulated),
            };
            return updated;
          });
        } catch {
          setChatMessages((prev2) => {
            const updated = [...prev2];
            updated[insertIdx] = {
              role: "assistant",
              content: "Failed to reach AI.",
              segments: [{ type: "text", content: "Failed to reach AI." }],
            };
            return updated;
          });
        } finally {
          isStreamingRef.current = false;
          setIsStreaming(false);
        }
      })();

      return next;
    });
  }, [pendingAiQuery, aiSidebarOpen, threads, toneProfile, setPendingAiQuery]);

  // ─── Build context payload ────────────────────────────
  const buildContextPayload = async () => {
    const contextPayload = aiContext.map((ctx) => {
      const thread = threads.find((t) => t.id === ctx.id);
      return {
        threadId: ctx.id,
        subject: ctx.label,
        messages: thread
          ? thread.participants.map((p) => ({
              from: p.name,
              body: "",
              sentAt: thread.lastMessageAt,
            }))
          : [],
      };
    });

    return Promise.all(
      contextPayload.map(async (ctx) => {
        try {
          const thread = threads.find((t) => t.id === ctx.threadId);
          const platform = thread?.platform;
          const url =
            platform === "DISCORD"
              ? `/api/discord/threads/${ctx.threadId}`
              : platform === "OUTLOOK"
                ? `/api/outlook/threads/${ctx.threadId}`
                : `/api/gmail/threads/${ctx.threadId}`;
          const res = await fetch(url);
          if (!res.ok) return ctx;
          const data = await res.json();
          return {
            threadId: ctx.threadId,
            subject: ctx.subject,
            messages: (data.messages ?? []).map(
              (m: { fromName: string; bodyText: string; sentAt: string }) => ({
                from: m.fromName,
                body: m.bodyText,
                sentAt: m.sentAt,
              }),
            ),
          };
        } catch {
          return ctx;
        }
      }),
    );
  };

  // ─── Stream AI response ───────────────────────────────
  const streamAiResponse = async (
    prompt: string,
    fullContext: Awaited<ReturnType<typeof buildContextPayload>>,
    insertIdx: number,
  ) => {
    setIsStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          context: fullContext.length > 0 ? fullContext : undefined,
          toneProfile: toneProfile ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI request failed" }));
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[insertIdx] = {
            role: "assistant",
            content: err.error || "Something went wrong. Check your API key in Settings.",
            segments: [{ type: "text", content: err.error || "Something went wrong." }],
          };
          return updated;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[insertIdx] = {
            role: "assistant",
            content: current,
            segments: parseAiContent(current),
          };
          return updated;
        });
      }

      // Final parse
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[insertIdx] = {
          role: "assistant",
          content: accumulated,
          segments: parseAiContent(accumulated),
        };
        return updated;
      });
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[insertIdx] = {
          role: "assistant",
          content: "Failed to reach AI. Check your connection and API key.",
          segments: [{ type: "text", content: "Failed to reach AI. Check your connection and API key." }],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // ─── Send user message ────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const contextLabels = aiContext.map((c) => c.label);
    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      context: contextLabels.length > 0 ? contextLabels : undefined,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const fullContext = await buildContextPayload();

    const insertIdx = chatMessages.length + 1; // after user msg
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", segments: [] },
    ]);

    await streamAiResponse(prompt, fullContext, insertIdx);
  };

  // ─── Handle MCQ answer ────────────────────────────────
  const handleMcqAnswer = async (
    msgIdx: number,
    answers: Record<string, string>,
  ) => {
    // Mark MCQ as answered
    setChatMessages((prev) => {
      const updated = [...prev];
      updated[msgIdx] = { ...updated[msgIdx], mcqAnswered: true };
      return updated;
    });

    // Build a user message with the answers
    const answerText = Object.entries(answers)
      .map(([, value]) => value)
      .join(", ");

    const userMsg: ChatMessage = {
      role: "user",
      content: answerText,
    };

    setChatMessages((prev) => [...prev, userMsg]);

    const fullContext = await buildContextPayload();

    const insertIdx = chatMessages.length + 2; // after updated msg + user answer
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", segments: [] },
    ]);

    await streamAiResponse(
      `My answers: ${answerText}`,
      fullContext,
      insertIdx,
    );
  };

  // ─── Copy draft to clipboard ──────────────────────────
  const handleCopyDraft = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedDraft(text);
    setTimeout(() => setCopiedDraft(null), 2000);
  };

  // ─── Send draft via the appropriate platform ──────────
  const handleSendDraft = async (text: string) => {
    // Determine target from the first context thread
    const targetCtx = aiContext[0];
    if (!targetCtx) {
      // No context thread — fall back to copy
      await handleCopyDraft(text);
      return;
    }

    const targetThread = threads.find((t) => t.id === targetCtx.id);
    if (!targetThread) {
      await handleCopyDraft(text);
      return;
    }

    setSendingDraft(text);

    try {
      if (targetThread.platform === "DISCORD") {
        const channelId = targetThread.id.replace(/^discord-/, "");
        const res = await fetch("/api/discord/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content: text }),
        });
        if (!res.ok) throw new Error("Discord send failed");
      } else if (targetThread.platform === "OUTLOOK") {
        const lastParticipant = targetThread.participants[0];
        const res = await fetch("/api/outlook/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lastParticipant?.email ?? "",
            subject: targetThread.subject,
            body: text,
          }),
        });
        if (!res.ok) throw new Error("Outlook send failed");
      } else {
        // Gmail: reply to the thread
        const lastParticipant = targetThread.participants[0];
        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: targetThread.id,
            to: lastParticipant?.email ?? "",
            subject: targetThread.subject,
            body: text,
          }),
        });
        if (!res.ok) throw new Error("Gmail send failed");
      }

      setSentDraft(text);
      setTimeout(() => setSentDraft(null), 3000);
    } catch (err) {
      console.error("Send draft error:", err);
      // Fall back to copy on failure
      await handleCopyDraft(text);
    } finally {
      setSendingDraft(null);
    }
  };

  // ─── Handle compose from AI ──────────────────────────
  const handleCompose = (data: ComposeData) => {
    setComposeOpen(true);
    setComposeMinimized(false);
    // Dispatch a custom event so the compose panel can pick up the pre-filled data
    window.dispatchEvent(
      new CustomEvent("dirac:prefill-compose", { detail: data }),
    );
  };

  // ─── Handle inbox actions from AI ───────────────────
  const handleExecuteActions = (items: ActionItem[]) => {
    for (const item of items) {
      switch (item.action) {
        case "star":
        case "unstar":
          toggleStarred(item.threadId);
          break;
        case "mark_read":
          markThreadRead(item.threadId);
          break;
        case "mark_unread":
          markThreadUnread(item.threadId);
          break;
        case "mark_urgent":
        case "remove_urgent":
          toggleUrgent(item.threadId);
          break;
        case "archive":
          archiveThread(item.threadId);
          break;
        case "trash":
          trashThread(item.threadId);
          break;
      }
    }
  };

  // ─── Clear chat ───────────────────────────────────────
  const handleClearChat = () => {
    setChatMessages([]);
  };

  // Resolve a thread ID — the AI may hallucinate IDs, so fall back to matching by subject
  const resolveThreadId = useCallback(
    (threadId: string, subject?: string, from?: string): string | null => {
      if (threads.some((t) => t.id === threadId)) return threadId;
      // Fallback: match by subject
      if (subject) {
        const subjectLower = subject.toLowerCase();
        const match = threads.find((t) =>
          t.subject.toLowerCase().includes(subjectLower) ||
          subjectLower.includes(t.subject.toLowerCase()),
        );
        if (match) return match.id;
      }
      // Fallback: match by sender name
      if (from) {
        const fromLower = from.toLowerCase();
        const match = threads.find((t) =>
          t.participants.some(
            (p) =>
              p.name.toLowerCase().includes(fromLower) ||
              p.email.toLowerCase().includes(fromLower),
          ),
        );
        if (match) return match.id;
      }
      return null;
    },
    [threads],
  );

  // Preview a thread in the center column
  const handlePreviewThread = useCallback(
    (threadId: string, subject?: string, from?: string) => {
      const realId = resolveThreadId(threadId, subject, from);
      if (realId) {
        router.push("/inbox");
        setSelectedThreadId(realId);
      }
    },
    [resolveThreadId, router, setSelectedThreadId],
  );

  // Available threads for context picker
  const availableThreads = threads.map((t) => ({
    id: t.id,
    label: t.subject,
    platform: t.platform,
  }));

  const hasContext = aiContext.length > 0;

  if (!aiSidebarOpen) return null;

  return (
    <div className="dirac-panel flex w-80 flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex h-[49px] items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI</span>
          {hasContext && (
            <span className="text-[10px] text-muted-foreground">
              {aiContext.length} thread{aiContext.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {chatMessages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleClearChat}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setAiSidebarOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Chat transcript ────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 px-3 py-3">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Ask anything, or add threads for context
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                Summarize, draft, extract tasks, and more
              </p>
            </div>
          ) : (
            chatMessages.map((msg, idx) => (
              <ChatBubble
                key={idx}
                msg={msg}
                msgIdx={idx}
                isStreaming={isStreaming && idx === chatMessages.length - 1}
                selectedThreadId={selectedThreadId}
                copiedDraft={copiedDraft}
                sendingDraft={sendingDraft}
                sentDraft={sentDraft}
                hasContext={hasContext}
                onMcqAnswer={handleMcqAnswer}
                onCopyDraft={handleCopyDraft}
                onSendDraft={handleSendDraft}
                onCompose={handleCompose}
                onExecuteActions={handleExecuteActions}
                onViewThread={handlePreviewThread}
              />
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* ─── Input area ──────────────────────────────────── */}
      <div className="border-t border-border">
        {/* Context chips */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {aiContext.map((ctx) => {
              const isViewing = ctx.id === selectedThreadId;
              return (
                <span
                  key={ctx.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors",
                    isViewing
                      ? "bg-primary/15 text-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  <button
                    onClick={() => handlePreviewThread(ctx.id)}
                    className="inline-flex items-center gap-1 hover:underline"
                    title="Preview this thread"
                  >
                    <Mail className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    <span className="max-w-[120px] truncate">{ctx.label}</span>
                  </button>
                  <button
                    onClick={() => removeFromAiContext(ctx.id)}
                    className="ml-0.5 rounded-sm opacity-40 hover:opacity-100"
                    title="Remove from context"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        <div className="px-3 pt-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              hasContext ? "Ask about this thread..." : "Ask anything..."
            }
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5">
          {/* Left: context controls */}
          <div className="relative flex items-center gap-1" ref={pickerRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setContextPickerOpen(!contextPickerOpen)}
              disabled={threads.length === 0}
            >
              <Plus className="h-3 w-3" />
              Context
            </Button>

            {/* Context picker popover */}
            {contextPickerOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-lg border border-border bg-popover shadow-md">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  Select threads as context
                </div>
                <div className="max-h-56 overflow-y-auto border-t border-border">
                  {availableThreads.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No threads available
                    </div>
                  ) : (
                    availableThreads.map((item) => {
                      const isSelected = aiContext.some(
                        (c) => c.id === item.id,
                      );
                      return (
                        <div
                          key={item.id}
                          className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50"
                        >
                          <button
                            onClick={() =>
                              toggleAiContext({
                                id: item.id,
                                label: item.label,
                              })
                            }
                            className="shrink-0"
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-muted-foreground",
                              )}
                            >
                              {isSelected && (
                                <Check className="h-2.5 w-2.5" />
                              )}
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              handlePreviewThread(item.id);
                              setContextPickerOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            {item.platform === "DISCORD" ? (
                              <MessageSquare className="h-3 w-3 shrink-0 text-indigo-500" />
                            ) : (
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-xs text-foreground">
                              {item.label}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              handlePreviewThread(item.id);
                              setContextPickerOpen(false);
                            }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground"
                            title="Preview thread"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: send */}
          <Button
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ChatBubble sub-component ───────────────────────────

function ChatBubble({
  msg,
  msgIdx,
  isStreaming,
  selectedThreadId,
  copiedDraft,
  sendingDraft,
  sentDraft,
  hasContext,
  onMcqAnswer,
  onCopyDraft,
  onSendDraft,
  onCompose,
  onExecuteActions,
  onViewThread,
}: {
  msg: ChatMessage;
  msgIdx: number;
  isStreaming: boolean;
  selectedThreadId: string | null;
  copiedDraft: string | null;
  sendingDraft: string | null;
  sentDraft: string | null;
  hasContext: boolean;
  onMcqAnswer: (msgIdx: number, answers: Record<string, string>) => void;
  onCopyDraft: (text: string) => void;
  onSendDraft: (text: string) => void;
  onCompose: (data: ComposeData) => void;
  onExecuteActions: (items: ActionItem[]) => void;
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  const [mcqSelections, setMcqSelections] = useState<Record<string, string>>({});

  if (msg.role === "user") {
    return (
      <div className="flex flex-col gap-1">
        {msg.context && msg.context.length > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60 mr-1">
            <Mail className="h-2.5 w-2.5" />
            {msg.context.length === 1
              ? msg.context[0].slice(0, 30) +
                (msg.context[0].length > 30 ? "..." : "")
              : `${msg.context.length} threads`}
          </div>
        )}
        <div className="ml-8 rounded-lg bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground">
          <div className="whitespace-pre-wrap">{msg.content}</div>
        </div>
      </div>
    );
  }

  // Assistant message — render segments
  const segments = msg.segments ?? parseAiContent(msg.content);

  return (
    <div className="flex flex-col gap-2">
      {segments.map((seg, segIdx) => {
        if (seg.type === "mcq" && seg.mcq) {
          return (
            <McqBlock
              key={segIdx}
              questions={seg.mcq}
              answered={msg.mcqAnswered ?? false}
              selections={mcqSelections}
              onSelect={(qId, option) => {
                setMcqSelections((prev) => ({ ...prev, [qId]: option }));
              }}
              onSubmit={() => onMcqAnswer(msgIdx, mcqSelections)}
              isStreaming={isStreaming}
            />
          );
        }

        if (seg.type === "draft") {
          return (
            <DraftBlock
              key={segIdx}
              content={seg.content}
              isCopied={copiedDraft === seg.content}
              isSending={sendingDraft === seg.content}
              isSent={sentDraft === seg.content}
              hasContext={hasContext}
              onCopy={() => onCopyDraft(seg.content)}
              onSend={() => onSendDraft(seg.content)}
            />
          );
        }

        if (seg.type === "compose" && seg.compose) {
          return (
            <ComposeBlock
              key={segIdx}
              data={seg.compose}
              onOpen={() => onCompose(seg.compose!)}
            />
          );
        }

        if (seg.type === "actions" && seg.actions) {
          return (
            <ActionsBlock
              key={segIdx}
              items={seg.actions}
              onExecute={() => onExecuteActions(seg.actions!)}
            />
          );
        }

        if (seg.type === "results" && seg.results) {
          return (
            <ResultsBlock
              key={segIdx}
              items={seg.results}
              onViewThread={onViewThread}
            />
          );
        }

        // Plain text
        return (
          <div
            key={segIdx}
            className="mr-2 rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground"
          >
            <div className="whitespace-pre-wrap">{seg.content}</div>
          </div>
        );
      })}

      {/* Streaming indicator when content is empty */}
      {isStreaming && segments.length === 0 && (
        <div className="mr-2 rounded-lg bg-muted px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ─── MCQ Block ──────────────────────────────────────────

function McqBlock({
  questions,
  answered,
  selections,
  onSelect,
  onSubmit,
  isStreaming,
}: {
  questions: McqQuestion[];
  answered: boolean;
  selections: Record<string, string>;
  onSelect: (questionId: string, option: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
}) {
  const allAnswered = questions.every((q) => selections[q.id]);

  return (
    <div className="mr-2 space-y-3 rounded-lg border border-border bg-muted/50 px-3 py-3">
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-[12px] font-medium text-foreground">
            {q.question}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((opt) => {
              const isSelected = selections[q.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => !answered && onSelect(q.id, opt)}
                  disabled={answered}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    answered && isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : answered
                        ? "border-border text-muted-foreground opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!answered && (
        <Button
          size="sm"
          className="h-7 w-full text-xs"
          onClick={onSubmit}
          disabled={!allAnswered || isStreaming}
        >
          {isStreaming ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <CornerUpRight className="mr-1.5 h-3 w-3" />
          )}
          Continue
        </Button>
      )}
    </div>
  );
}

// ─── Draft Block ────────────────────────────────────────

function DraftBlock({
  content,
  isCopied,
  isSending,
  isSent,
  hasContext,
  onCopy,
  onSend,
}: {
  content: string;
  isCopied: boolean;
  isSending: boolean;
  isSent: boolean;
  hasContext: boolean;
  onCopy: () => void;
  onSend: () => void;
}) {
  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-primary/20">
      {/* Draft header */}
      <div className="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-primary/70">
          Draft
        </span>
        {isSent && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <Check className="h-3 w-3" />
            Sent
          </span>
        )}
      </div>

      {/* Draft body */}
      <div className="bg-muted/30 px-3 py-2.5">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {content}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 border-t border-primary/10 bg-primary/5 px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onCopy}
          disabled={isSending}
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={onSend}
          disabled={isSending || isSent}
        >
          {isSending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Sending...
            </>
          ) : isSent ? (
            <>
              <Check className="h-3 w-3" />
              Sent
            </>
          ) : (
            <>
              <Send className="h-3 w-3" />
              {hasContext ? "Send" : "Copy"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Compose Block ──────────────────────────────────────

function ComposeBlock({
  data,
  onOpen,
}: {
  data: ComposeData;
  onOpen: () => void;
}) {
  const [opened, setOpened] = useState(false);

  const handleOpen = () => {
    onOpen();
    setOpened(true);
  };

  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-blue-500/20">
      <div className="flex items-center justify-between border-b border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600/70">
          New email
        </span>
        {opened && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <Check className="h-3 w-3" />
            Opened
          </span>
        )}
      </div>

      <div className="bg-muted/30 px-3 py-2.5 space-y-1.5">
        {data.to && (
          <div className="text-[11px]">
            <span className="text-muted-foreground">To: </span>
            <span className="text-foreground">{data.to}</span>
          </div>
        )}
        <div className="text-[11px]">
          <span className="text-muted-foreground">Subject: </span>
          <span className="text-foreground font-medium">{data.subject}</span>
        </div>
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground pt-1 border-t border-border/50">
          {data.body}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={handleOpen}
          disabled={opened}
        >
          {opened ? (
            <>
              <Check className="h-3 w-3" />
              Opened in Compose
            </>
          ) : (
            <>
              <PenSquare className="h-3 w-3" />
              Open in Compose
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Actions Block ──────────────────────────────────────

const ACTION_META: Record<string, { icon: typeof Star; label: string; color: string }> = {
  star: { icon: Star, label: "Star", color: "text-yellow-500" },
  unstar: { icon: StarOff, label: "Unstar", color: "text-muted-foreground" },
  mark_read: { icon: MailOpen, label: "Mark read", color: "text-muted-foreground" },
  mark_unread: { icon: MailX, label: "Mark unread", color: "text-blue-500" },
  mark_urgent: { icon: AlertTriangle, label: "Mark urgent", color: "text-red-500" },
  remove_urgent: { icon: AlertTriangle, label: "Remove urgent", color: "text-muted-foreground" },
  archive: { icon: Archive, label: "Archive", color: "text-muted-foreground" },
  trash: { icon: Trash2, label: "Trash", color: "text-red-500" },
};

function ActionsBlock({
  items,
  onExecute,
}: {
  items: ActionItem[];
  onExecute: () => void;
}) {
  const [executed, setExecuted] = useState(false);

  const handleExecute = () => {
    onExecute();
    setExecuted(true);
  };

  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-orange-500/20">
      <div className="flex items-center justify-between border-b border-orange-500/10 bg-orange-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-orange-600/70">
          {items.length} action{items.length !== 1 ? "s" : ""}
        </span>
        {executed && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
      </div>

      <div className="bg-muted/30 divide-y divide-border/50">
        {items.map((item, i) => {
          const meta = ACTION_META[item.action] || {
            icon: Mail,
            label: item.action,
            color: "text-muted-foreground",
          };
          const Icon = meta.icon;

          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <Icon className={cn("h-3 w-3 shrink-0", meta.color)} />
              <span className="text-[11px] text-muted-foreground shrink-0">
                {meta.label}
              </span>
              <span className="text-[12px] text-foreground truncate">
                {item.subject}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 border-t border-orange-500/10 bg-orange-500/5 px-3 py-1.5">
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={handleExecute}
          disabled={executed}
        >
          {executed ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Applied
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" />
              Apply all
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Results Block (search results) ─────────────────────

function ResultsBlock({
  items,
  onViewThread,
}: {
  items: ResultItem[];
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-blue-500/20">
      <div className="border-b border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600/70">
          {items.length} result{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-muted/30 divide-y divide-border/50">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onViewThread(item.threadId, item.subject, item.from)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">
                {item.subject}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {item.from} &middot; {item.reason}
              </p>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
          </button>
        ))}
      </div>
    </div>
  );
}
