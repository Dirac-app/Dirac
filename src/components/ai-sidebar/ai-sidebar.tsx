"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
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
  Inbox,
  User,
  History,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAppState } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  loadRecentSends,
  recordRecentSend,
} from "@/lib/recent-sends";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  TOPIC_TAG_LABELS,
  TOPIC_TAG_COLORS,
} from "@/lib/types";
import type { TopicTag } from "@/lib/types";
import {
  parseAiContent,
  type McqQuestion,
  type ComposeData,
  type ActionItem,
  type ResultItem,
  type ParsedSegment,
} from "@/lib/ai-parser";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string[];
  segments?: ParsedSegment[];
  mcqAnswered?: boolean;
}

// ─── Chat session (history) ─────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const CHAT_SESSIONS_KEY = "dirac_chat_sessions";
const ACTIVE_CHAT_KEY = "dirac_active_chat";

function generateChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function deriveChatTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m?.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + "..." : text;
}

function loadChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return parsed
      .filter(Boolean)
      .map((s) => ({ ...s, messages: (s.messages ?? []).filter(Boolean) }));
  } catch {
    return [];
  }
}

function saveChatSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

function loadActiveChatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

function saveActiveChatId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch {}
}

// parseAiContent is imported from @/lib/ai-parser

// ─── AI-initiated compose: shared state shape ──────────────────────────────
//
// Tracks the lifecycle of a single AI-proposed `compose` block from the
// moment the user hits Send to the post-send rendered card. The delayed
// "pending" window is what gives us the gmail-style Undo affordance.

export type ComposeSendState =
  | { status: "pending"; timer: ReturnType<typeof setTimeout>; sendAt: number }
  | { status: "sending" }
  | { status: "sent"; threadId?: string; sentAt: number; to: string }
  | { status: "error"; message: string };

// ─── Component ──────────────────────────────────────────

export function AiSidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const {
    aiSidebarOpen,
    setAiSidebarOpen,
    selectedThreadId,
    setSelectedThreadId,
    threads,
    aiContext,
    addToAiContext,
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
    triageMap,
    categoryMap,
    topicMap,
    commitments,
    selectedThreadIds,
  } = useAppState();

  // ─── Chat session management ────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Ref so setChatMessages always reads the latest ID without stale closures
  const activeChatIdRef = useRef<string | null>(null);

  const setActiveChatIdSynced = useCallback((id: string | null) => {
    activeChatIdRef.current = id;
    setActiveChatId(id);
    saveActiveChatId(id);
  }, []);

  useEffect(() => {
    const loaded = loadChatSessions();
    // Prune ghost sessions (empty or no messages) that were created by the stale-closure bug
    const valid = loaded.filter((s) => s.messages.length > 0);
    if (valid.length !== loaded.length) saveChatSessions(valid);
    setSessions(valid);
    const savedId = loadActiveChatId();
    if (savedId && valid.some((s) => s.id === savedId)) {
      activeChatIdRef.current = savedId;
      setActiveChatId(savedId);
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeChatId);
  const chatMessages = activeSession?.messages ?? [];

  const setChatMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setSessions((prevSessions) => {
        // Always read from the ref — never from the stale closure
        let currentId = activeChatIdRef.current;

        if (!currentId) {
          currentId = generateChatId();
          activeChatIdRef.current = currentId;   // update ref immediately
          setActiveChatId(currentId);            // schedule state update
          saveActiveChatId(currentId);
        }

        const now = new Date().toISOString();
        const existing = prevSessions.find((s) => s.id === currentId);
        const prevMessages = existing?.messages ?? [];
        const nextMessages =
          typeof updater === "function" ? updater(prevMessages) : updater;

        const title = deriveChatTitle(nextMessages.filter(Boolean));

        const updatedSession: ChatSession = existing
          ? { ...existing, messages: nextMessages, title, updatedAt: now }
          : { id: currentId!, title, messages: nextMessages, createdAt: now, updatedAt: now };

        const next = [
          updatedSession,
          ...prevSessions.filter((s) => s.id !== currentId),
        ];
        saveChatSessions(next);
        return next;
      });
    },
    [], // no dependency on activeChatId — reads from ref instead
  );

  const handleNewChat = useCallback(() => {
    const id = generateChatId();
    setActiveChatIdSynced(id);
    setHistoryOpen(false);
  }, [setActiveChatIdSynced]);

  const handleSwitchChat = useCallback((id: string) => {
    setActiveChatIdSynced(id);
    setHistoryOpen(false);
  }, [setActiveChatIdSynced]);

  const handleDeleteChat = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveChatSessions(next);
        return next;
      });
      if (activeChatId === id) {
        setActiveChatIdSynced(null);
      }
    },
    [activeChatId, setActiveChatIdSynced],
  );

  const [input, setInput] = useState("");
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [sentDraft, setSentDraft] = useState<string | null>(null);

  // ─── AI-initiated compose: send-state per compose block ─────────────────
  // Keyed by JSON.stringify(compose) so the same compose block stays in sync
  // even if React re-renders/reorders chat segments. Each entry tracks the
  // delayed-send window so the user can hit "Undo" before we actually fire.
  const [composeSends, setComposeSends] = useState<Record<string, ComposeSendState>>({});
  const composeSendsRef = useRef(composeSends);
  composeSendsRef.current = composeSends;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
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

    // Build thread summaries with category/triage metadata for batch intelligence
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
      category: categoryMap[t.id],
      triage: triageMap[t.id],
      lastMessageAt: t.lastMessageAt,
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
              inboxContext: buildInboxOverview(),
              contactDirectory: buildContactDirectory(),
              recentSends: [...buildPendingSends(), ...loadRecentSends()],
              toneProfile: toneProfile ?? undefined,
              preset: localStorage.getItem("dirac-ai-preset") || undefined,
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
  }, [pendingAiQuery, aiSidebarOpen, threads, toneProfile, setPendingAiQuery, categoryMap, triageMap]);

  // ─── In-flight sends (5-8s pending window) ──────────────────────────────
  // recentSends in localStorage only covers committed sends. Within the undo
  // window the AI would otherwise be blind to "I just kicked off a send" and
  // could happily compose a duplicate if the user types a follow-up fast.
  // We surface pending entries with a clear marker so the AI treats them as
  // "in flight, don't propose again" without conflating with delivered mail.
  const buildPendingSends = useCallback(() => {
    const pending: { to: string; subject: string; bodyPreview: string; sentAt: string }[] = [];
    for (const [key, state] of Object.entries(composeSends)) {
      if (state.status !== "pending" && state.status !== "sending") continue;
      try {
        const data = JSON.parse(key) as ComposeData;
        pending.push({
          to: data.to.trim().toLowerCase(),
          subject: `[in flight] ${data.subject}`,
          bodyPreview: data.body.replace(/\s+/g, " ").slice(0, 120),
          sentAt: new Date().toISOString(),
        });
      } catch {}
    }
    return pending;
  }, [composeSends]);

  // ─── Build contact directory (for AI to resolve "email Sarah" → address) ──
  // Counts how often each address appears as a thread participant and returns
  // the top 50. We exclude the user's own address (no point emailing yourself)
  // and obvious noreply senders since the AI shouldn't propose those as
  // recipients of a new compose.
  const buildContactDirectory = useCallback(() => {
    const counts = new Map<string, { name: string; email: string; count: number }>();
    const myEmail = session?.user?.email?.toLowerCase() ?? "";

    for (const t of threads) {
      for (const p of t.participants) {
        const email = p.email?.trim().toLowerCase();
        if (!email) continue;
        if (email === myEmail) continue;
        if (/^(noreply|no-reply|donotreply|do-not-reply|notifications?|mailer-daemon)@/.test(email)) continue;

        const existing = counts.get(email);
        if (existing) {
          existing.count += 1;
          if (!existing.name && p.name) existing.name = p.name;
        } else {
          counts.set(email, { name: p.name ?? "", email: p.email, count: 1 });
        }
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map((c) => ({ name: c.name || undefined, email: c.email, count: c.count }));
  }, [threads, session?.user?.email]);

  // ─── Build inbox overview (always included in every message) ─────────────
  const buildInboxOverview = useCallback(() => {
    return threads
      .slice()
      .sort((a, b) => {
        // Sort: urgent first, then unread, then most recent
        if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
        if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      })
      .slice(0, 80)
      .map((t) => ({
        threadId:      t.id,
        subject:       t.subject,
        from:          t.participants[0]?.name ?? t.participants[0]?.email ?? "Unknown",
        snippet:       t.snippet?.slice(0, 120),
        lastMessageAt: t.lastMessageAt,
        triage:        triageMap[t.id],
        category:      categoryMap[t.id],
        topics:        topicMap[t.id] ?? [],
        isUrgent:      t.isUrgent,
        isUnread:      t.isUnread,
        isStarred:     t.isStarred,
      }));
  }, [threads, triageMap, categoryMap, topicMap]);

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
        category: thread ? categoryMap[thread.id] : undefined,
        triage: thread ? triageMap[thread.id] : undefined,
        lastMessageAt: thread?.lastMessageAt,
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
            category: ctx.category,
            triage: ctx.triage,
            lastMessageAt: ctx.lastMessageAt,
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
          inboxContext: buildInboxOverview(),
          contactDirectory: buildContactDirectory(),
          recentSends: [...buildPendingSends(), ...loadRecentSends()],
          toneProfile: toneProfile ?? undefined,
          preset: localStorage.getItem("dirac-ai-preset") || undefined,
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

  // ─── Edit a past user message and re-run the AI from that point ──────
  // Mirrors the ChatGPT/Claude pattern: changing a prior question truncates
  // everything downstream (old answers, follow-ups) and streams a fresh reply.
  const handleEditUserMessage = async (msgIdx: number, newContent: string) => {
    if (isStreaming) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    const target = chatMessages[msgIdx];
    if (!target || target.role !== "user") return;
    // No-op if the content didn't change — spare the user a pointless regen.
    if (trimmed === target.content.trim()) return;

    const contextLabels = aiContext.map((c) => c.label);
    const editedMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      context: contextLabels.length > 0 ? contextLabels : undefined,
    };

    // Keep everything BEFORE the edited message; drop the old version and
    // all subsequent turns. Then append the edited user msg + empty assistant
    // placeholder for the stream to fill in.
    setChatMessages((prev) => [
      ...prev.slice(0, msgIdx),
      editedMsg,
      { role: "assistant", content: "", segments: [] },
    ]);

    const fullContext = await buildContextPayload();
    const insertIdx = msgIdx + 1; // position of the new assistant placeholder

    await streamAiResponse(trimmed, fullContext, insertIdx);
  };

  // ─── Persist user edits to an MCQ's options (inline edit + custom) ────
  const handleMcqQuestionsChange = (
    msgIdx: number,
    segIdx: number,
    next: McqQuestion[],
  ) => {
    setChatMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIdx];
      if (!msg || !msg.segments) return prev;
      const newSegments = msg.segments.map((seg, i) =>
        i === segIdx && seg.type === "mcq" ? { ...seg, mcq: next } : seg,
      );
      updated[msgIdx] = { ...msg, segments: newSegments };
      return updated;
    });
  };

  // ─── Persist user edits to a draft's body ─────────────────────────────
  // Drafts are reply-shaped — the recipient is implicit (the in-context
  // thread's participants), so the only thing the user can edit is the body.
  const handleDraftEdit = (
    msgIdx: number,
    segIdx: number,
    nextBody: string,
  ) => {
    setChatMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIdx];
      if (!msg || !msg.segments) return prev;
      const newSegments = msg.segments.map((seg, i) =>
        i === segIdx && seg.type === "draft" ? { ...seg, content: nextBody } : seg,
      );
      updated[msgIdx] = { ...msg, segments: newSegments };
      return updated;
    });
  };

  // ─── Persist user edits to a compose block (to/subject/body) ──────────
  // Important: editing changes the JSON.stringify key used by composeSends,
  // which intentionally invalidates any in-flight send state for this block.
  // Editing mid-undo cancels the pending send by stale-keying it.
  const handleComposeEdit = (
    msgIdx: number,
    segIdx: number,
    next: ComposeData,
  ) => {
    setChatMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIdx];
      if (!msg || !msg.segments) return prev;
      const newSegments = msg.segments.map((seg, i) =>
        i === segIdx && seg.type === "compose"
          ? { ...seg, compose: next, content: JSON.stringify(next) }
          : seg,
      );
      updated[msgIdx] = { ...msg, segments: newSegments };
      return updated;
    });
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
  // Punts an AI-drafted email into the floating ComposePanel, where the user
  // gets the full editor (CC/BCC, attachments, free-form body editing).
  const handleCompose = (data: ComposeData) => {
    setComposeOpen(true);
    setComposeMinimized(false);
    window.dispatchEvent(
      new CustomEvent("dirac:prefill-compose", { detail: data }),
    );
  };

  // ─── AI-initiated send: helpers ──────────────────────
  // Loose RFC-5322-ish check. We only need to catch obvious junk before the
  // platform API does the heavy lifting — overzealous validation here would
  // block real edge-case addresses (`+tag`, dotted locals, etc.).
  const isValidEmail = useCallback((s: string): boolean => {
    const t = s.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }, []);

  // "Known contact" = somebody whose email appears as a participant on any
  // existing thread. Used to gate the soft warning + extended undo window.
  const knownContactEmails = useMemo(() => {
    const set = new Set<string>();
    for (const t of threads) {
      for (const p of t.participants) {
        if (p.email) set.add(p.email.toLowerCase());
      }
    }
    return set;
  }, [threads]);

  const isKnownContact = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      if (!e) return false;
      return knownContactEmails.has(e);
    },
    [knownContactEmails],
  );

  // Pick the right send endpoint for net-new mail. Mirrors ComposePanel.
  const sendNewEmail = useCallback(
    async (data: ComposeData): Promise<{ ok: true; threadId?: string } | { ok: false; error: string }> => {
      try {
        const isGmail = !!session?.gmailConnected;
        const url = isGmail ? "/api/gmail/send" : "/api/outlook/send";
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: data.to.trim(),
            subject: data.subject.trim(),
            body: data.body,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          return { ok: false, error: errBody.error || `Send failed (${res.status})` };
        }
        const okBody = await res.json().catch(() => ({}));
        return { ok: true, threadId: okBody.threadId };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [session?.gmailConnected],
  );

  // Stable per-block key so React state survives re-renders/streams.
  const composeKey = useCallback((data: ComposeData) => JSON.stringify(data), []);

  // Schedule a send with a delay window so the user can hit "Undo".
  // Soft first-contact protection: 8s for new recipients, 5s otherwise.
  const handleSendCompose = useCallback(
    (data: ComposeData) => {
      const key = composeKey(data);
      const newContact = !isKnownContact(data.to);
      const delayMs = newContact ? 8000 : 5000;
      const sendAt = Date.now() + delayMs;

      const fire = async () => {
        // If the user hit undo in the meantime, the entry will already be gone.
        const current = composeSendsRef.current[key];
        if (!current || current.status !== "pending") return;

        setComposeSends((prev) => ({ ...prev, [key]: { status: "sending" } }));

        const result = await sendNewEmail(data);

        if (result.ok) {
          recordRecentSend({
            to: data.to,
            subject: data.subject,
            body: data.body,
            threadId: result.threadId,
          });
          setComposeSends((prev) => ({
            ...prev,
            [key]: {
              status: "sent",
              threadId: result.threadId,
              sentAt: Date.now(),
              to: data.to.trim(),
            },
          }));
          toast({
            title: "Sent",
            description: `Email delivered to ${data.to.trim()}`,
            variant: "success",
          });
        } else {
          setComposeSends((prev) => ({
            ...prev,
            [key]: { status: "error", message: result.error },
          }));
          toast({
            title: "Send failed",
            description: result.error,
            variant: "error",
          });
        }
      };

      const timer = setTimeout(fire, delayMs);
      setComposeSends((prev) => ({
        ...prev,
        [key]: { status: "pending", timer, sendAt },
      }));

      toast({
        title: newContact ? "Sending to new recipient…" : "Sending…",
        description: newContact
          ? `${data.to.trim()} hasn't been emailed before. Undo within ${Math.round(delayMs / 1000)}s.`
          : `Will deliver to ${data.to.trim()} in ${Math.round(delayMs / 1000)}s.`,
        variant: newContact ? "info" : "default",
        duration: delayMs + 200,
      });
    },
    [composeKey, isKnownContact, sendNewEmail, toast],
  );

  const handleCancelCompose = useCallback(
    (data: ComposeData) => {
      const key = composeKey(data);
      const entry = composeSendsRef.current[key];
      if (!entry || entry.status !== "pending") return;
      clearTimeout(entry.timer);
      setComposeSends((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast({ title: "Send cancelled", variant: "default" });
    },
    [composeKey, toast],
  );

  // Open the resulting thread (or the inbox) after a successful sidebar-send.
  const handleOpenSentThread = useCallback(
    (threadId?: string) => {
      router.push("/inbox");
      if (threadId) setSelectedThreadId(threadId);
    },
    [router, setSelectedThreadId],
  );

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

  // ─── Clear chat (start fresh) ─────────────────────────
  const handleClearChat = () => {
    handleNewChat();
  };

  // ─── Close history on outside click ────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    if (historyOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [historyOpen]);

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

  // Current thread for contextual suggestions
  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const handleSuggestionClick = (prompt: string) => {
    if (selectedThread && !aiContext.some((c) => c.id === selectedThread.id)) {
      addToAiContext({ id: selectedThread.id, label: selectedThread.subject });
    }
    setInput("");
    setPendingAiQuery(prompt);
  };

  const handleInboxSuggestionClick = (prompt: string) => {
    setInput("");
    setPendingAiQuery(prompt);
  };

  if (!aiSidebarOpen) return null;

  const nonEmptySessions = sessions.filter((s) => s.messages.length > 0);

  const isThreadOpen = !!selectedThreadId;

  return (
    <div className={cn("dirac-panel ai-panel-glow flex h-full flex-col overflow-hidden transition-[width] duration-200", isThreadOpen ? "w-96" : "w-80")}>
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="ai-glow-header flex h-[49px] items-center justify-between border-b border-border px-3">
        <div className="relative flex items-center gap-2 min-w-0" ref={historyRef}>
          <Sparkles className="ai-sparkle-glow h-4 w-4 text-primary shrink-0" />

          {/* Chat title / selector */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-1 min-w-0 group"
          >
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
              {chatMessages.length > 0 && activeSession
                ? activeSession.title.slice(0, 24) + (activeSession.title.length > 24 ? "..." : "")
                : "AI"
              }
            </span>
            <ChevronDown className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform",
              historyOpen && "rotate-180",
            )} />
          </button>

          {/* History dropdown */}
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Chat history</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={handleNewChat}
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {nonEmptySessions.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No past chats
                    </div>
                  ) : (
                    nonEmptySessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50",
                          session.id === activeChatId && "bg-accent/60",
                        )}
                      >
                        <button
                          onClick={() => handleSwitchChat(session.id)}
                          className="flex min-w-0 flex-1 flex-col text-left"
                        >
                          <span className="text-[12px] font-medium text-foreground truncate">
                            {session.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(session.id);
                          }}
                          className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setHistoryOpen(!historyOpen)}
            title="Chat history"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleNewChat}
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
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
            <SidebarIdleState
              threads={threads}
              selectedThread={selectedThread ?? null}
              triageMap={triageMap}
              categoryMap={categoryMap}
              topicMap={topicMap}
              commitments={commitments}
              selectedThreadIds={selectedThreadIds}
              onSuggestionClick={handleSuggestionClick}
              onInboxSuggestionClick={handleInboxSuggestionClick}
            />
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
                onMcqQuestionsChange={handleMcqQuestionsChange}
                onEditUserMessage={handleEditUserMessage}
                onCopyDraft={handleCopyDraft}
                onSendDraft={handleSendDraft}
                onDraftEdit={handleDraftEdit}
                onCompose={handleCompose}
                onSendCompose={handleSendCompose}
                onCancelCompose={handleCancelCompose}
                onOpenSentThread={handleOpenSentThread}
                onComposeEdit={handleComposeEdit}
                composeSends={composeSends}
                isKnownContact={isKnownContact}
                isValidEmail={isValidEmail}
                draftRecipient={(() => {
                  const ctx = aiContext[0];
                  if (!ctx) return null;
                  const t = threads.find((x) => x.id === ctx.id);
                  if (!t) return { label: ctx.label, email: null, name: null };
                  const p = t.participants[0];
                  return {
                    label: ctx.label,
                    email: p?.email ?? null,
                    name: p?.name ?? null,
                  };
                })()}
                onExecuteActions={handleExecuteActions}
                onViewThread={handlePreviewThread}
              />
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* ─── Input area ──────────────────────────────────── */}
      <div className="border-t border-border ai-glow-input">
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
              hasContext
                ? "Ask about this thread..."
                : selectedThread
                  ? `Ask about "${selectedThread.subject.slice(0, 30)}..."`
                  : "Ask anything..."
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
            className="h-7 w-7 p-0 ai-send-glow"
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
  onMcqQuestionsChange,
  onEditUserMessage,
  onCopyDraft,
  onSendDraft,
  onDraftEdit,
  onCompose,
  onSendCompose,
  onCancelCompose,
  onOpenSentThread,
  onComposeEdit,
  composeSends,
  isKnownContact,
  isValidEmail,
  draftRecipient,
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
  onMcqQuestionsChange: (msgIdx: number, segIdx: number, next: McqQuestion[]) => void;
  onEditUserMessage: (msgIdx: number, newContent: string) => void;
  onCopyDraft: (text: string) => void;
  onSendDraft: (text: string) => void;
  onDraftEdit: (msgIdx: number, segIdx: number, nextBody: string) => void;
  onCompose: (data: ComposeData) => void;
  onSendCompose: (data: ComposeData) => void;
  onCancelCompose: (data: ComposeData) => void;
  onOpenSentThread: (threadId?: string) => void;
  onComposeEdit: (msgIdx: number, segIdx: number, next: ComposeData) => void;
  composeSends: Record<string, ComposeSendState>;
  isKnownContact: (email: string) => boolean;
  isValidEmail: (email: string) => boolean;
  draftRecipient: { label: string; email: string | null; name: string | null } | null;
  onExecuteActions: (items: ActionItem[]) => void;
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  const [mcqSelections, setMcqSelections] = useState<Record<string, string>>({});
  const [editingUserMsg, setEditingUserMsg] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (msg.role === "user") {
    const beginEdit = () => {
      if (isStreaming) return;
      setEditDraft(msg.content);
      setEditingUserMsg(true);
      // Auto-size textarea after mount
      setTimeout(() => {
        if (editTextareaRef.current) {
          editTextareaRef.current.style.height = "auto";
          editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
          editTextareaRef.current.focus();
          editTextareaRef.current.select();
        }
      }, 0);
    };

    const cancelEdit = () => {
      setEditingUserMsg(false);
      setEditDraft("");
    };

    const commitEdit = () => {
      const trimmed = editDraft.trim();
      // Exit edit mode either way; only trigger regen if content actually changed
      setEditingUserMsg(false);
      setEditDraft("");
      if (!trimmed || trimmed === msg.content.trim()) return;
      onEditUserMessage(msgIdx, trimmed);
    };

    return (
      <div className="group flex flex-col gap-1">
        {msg.context && msg.context.length > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60 mr-1">
            <Mail className="h-2.5 w-2.5" />
            {msg.context.length === 1
              ? msg.context[0].slice(0, 30) +
                (msg.context[0].length > 30 ? "..." : "")
              : `${msg.context.length} threads`}
          </div>
        )}
        {editingUserMsg ? (
          <div className="ml-8 flex flex-col gap-1.5">
            <textarea
              ref={editTextareaRef}
              value={editDraft}
              onChange={(e) => {
                setEditDraft(e.target.value);
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="min-h-[40px] resize-none rounded-lg border border-primary/60 bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="ml-auto flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground/50 mr-1">
                Regenerates reply · ⌘↵ save, Esc cancel
              </span>
              <button
                onClick={cancelEdit}
                className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button
                size="sm"
                className="h-6 px-2.5 text-[11px]"
                onClick={commitEdit}
                disabled={!editDraft.trim() || editDraft.trim() === msg.content.trim()}
              >
                Save & regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative ml-8">
            <div className="rounded-lg bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground">
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {!isStreaming && (
              <button
                onClick={beginEdit}
                title="Edit message"
                className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
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
              onQuestionsChange={(next) => onMcqQuestionsChange(msgIdx, segIdx, next)}
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
              recipient={draftRecipient}
              onEdit={(next) => onDraftEdit(msgIdx, segIdx, next)}
              onCopy={() => onCopyDraft(seg.content)}
              onSend={() => onSendDraft(seg.content)}
            />
          );
        }

        if (seg.type === "compose" && seg.compose) {
          const composeData = seg.compose;
          const sendKey = JSON.stringify(composeData);
          return (
            <ComposeBlock
              key={segIdx}
              data={composeData}
              sendState={composeSends[sendKey]}
              isNewContact={!isKnownContact(composeData.to)}
              isValidRecipient={isValidEmail(composeData.to)}
              onEdit={(next) => onComposeEdit(msgIdx, segIdx, next)}
              onOpen={() => onCompose(composeData)}
              onSend={() => onSendCompose(composeData)}
              onCancel={() => onCancelCompose(composeData)}
              onOpenThread={(threadId) => onOpenSentThread(threadId)}
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

        // Rendered markdown
        return (
          <div
            key={segIdx}
            className="mr-2 rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1"
          >
            <ReactMarkdown>{seg.content}</ReactMarkdown>
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
  onQuestionsChange,
  isStreaming,
}: {
  questions: McqQuestion[];
  answered: boolean;
  selections: Record<string, string>;
  onSelect: (questionId: string, option: string) => void;
  onSubmit: () => void;
  onQuestionsChange: (next: McqQuestion[]) => void;
  isStreaming: boolean;
}) {
  const allAnswered = questions.every((q) => selections[q.id]);

  // {qId}:{optIdx} currently being inline-edited (null = none)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Per-question "Other…" state: qId → { active: boolean, text: string }
  const [customState, setCustomState] = useState<Record<string, { active: boolean; text: string }>>({});

  const updateOption = (qId: string, idx: number, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const next = questions.map((q) => {
      if (q.id !== qId) return q;
      const opts = [...q.options];
      const old = opts[idx];
      opts[idx] = trimmed;
      // If the edited option was selected, migrate the selection
      if (selections[qId] === old) onSelect(qId, trimmed);
      return { ...q, options: opts };
    });
    onQuestionsChange(next);
  };

  const addCustomOption = (qId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = questions.map((q) => {
      if (q.id !== qId) return q;
      // Avoid duplicates — just select the existing one
      if (q.options.includes(trimmed)) return q;
      return { ...q, options: [...q.options, trimmed] };
    });
    onQuestionsChange(next);
    onSelect(qId, trimmed);
    setCustomState((prev) => ({ ...prev, [qId]: { active: false, text: "" } }));
  };

  const commitEdit = () => {
    if (!editingKey) return;
    const [qId, idxStr] = editingKey.split(":");
    updateOption(qId, Number(idxStr), editDraft);
    setEditingKey(null);
    setEditDraft("");
  };

  return (
    <div className="mr-2 space-y-3 rounded-lg border border-border bg-muted/50 px-3 py-3">
      {questions.map((q) => {
        const custom = customState[q.id] ?? { active: false, text: "" };
        return (
          <div key={q.id} className="space-y-1.5">
            <p className="text-[12px] font-medium text-foreground">
              {q.question}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt, optIdx) => {
                const isSelected = selections[q.id] === opt;
                const key = `${q.id}:${optIdx}`;
                const isEditing = editingKey === key;

                if (isEditing) {
                  return (
                    <input
                      key={key}
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEdit();
                        } else if (e.key === "Escape") {
                          setEditingKey(null);
                          setEditDraft("");
                        }
                      }}
                      className="rounded-md border border-primary bg-background px-2.5 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring min-w-[80px]"
                    />
                  );
                }

                return (
                  <div key={key} className="group relative">
                    <button
                      onClick={() => !answered && onSelect(q.id, opt)}
                      disabled={answered}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                        // Pad right when edit icon is visible so text doesn't shift
                        !answered && "group-hover:pr-6",
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
                    {!answered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingKey(key);
                          setEditDraft(opt);
                        }}
                        title="Edit option"
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Custom "Other…" chip — always present while unanswered */}
              {!answered && (
                custom.active ? (
                  <input
                    autoFocus
                    placeholder="Type your own…"
                    value={custom.text}
                    onChange={(e) =>
                      setCustomState((prev) => ({
                        ...prev,
                        [q.id]: { active: true, text: e.target.value },
                      }))
                    }
                    onBlur={() => {
                      if (custom.text.trim()) {
                        addCustomOption(q.id, custom.text);
                      } else {
                        setCustomState((prev) => ({ ...prev, [q.id]: { active: false, text: "" } }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomOption(q.id, custom.text);
                      } else if (e.key === "Escape") {
                        setCustomState((prev) => ({ ...prev, [q.id]: { active: false, text: "" } }));
                      }
                    }}
                    className="rounded-md border border-dashed border-primary/60 bg-background px-2.5 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring min-w-[120px]"
                  />
                ) : (
                  <button
                    onClick={() =>
                      setCustomState((prev) => ({
                        ...prev,
                        [q.id]: { active: true, text: "" },
                      }))
                    }
                    title="Add your own answer"
                    className="flex items-center gap-1 rounded-md border border-dashed border-border/80 px-2.5 py-1 text-[11px] text-muted-foreground/70 transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Other…
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}

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
  recipient,
  onCopy,
  onSend,
  onEdit,
}: {
  content: string;
  isCopied: boolean;
  isSending: boolean;
  isSent: boolean;
  hasContext: boolean;
  recipient: { label: string; email: string | null; name: string | null } | null;
  onCopy: () => void;
  onSend: () => void;
  onEdit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep local draft state in sync if the source content changes (e.g.
  // a fresh stream rewrites the segment) and we're not actively editing.
  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  const beginEdit = () => {
    setDraft(content);
    setEditing(true);
    setTimeout(() => {
      const el = editRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(content);
  };

  const commitEdit = () => {
    const next = draft;
    setEditing(false);
    if (next !== content) onEdit(next);
  };

  // Heuristic recipient-mismatch warning. If the draft greeting names someone
  // who is clearly not the in-context participant, that's a strong signal the
  // AI mis-routed compose-vs-draft. We don't BLOCK sending — that would be
  // false-positive-y — but we surface the conflict prominently so the user
  // doesn't unwittingly send "Hey Artin," to peter@x.com.
  const greetingName = (() => {
    const m = content.match(/^\s*(?:hey|hi|hello|dear)\s+([a-z][a-z\-']{1,30})/i);
    return m ? m[1].toLowerCase() : null;
  })();
  const recipientName = recipient?.name?.split(/\s+/)[0]?.toLowerCase() ?? null;
  const recipientLocalPart = recipient?.email?.split("@")[0]?.toLowerCase() ?? null;
  const greetingMatchesRecipient =
    !greetingName ||
    !recipient ||
    (recipientName && greetingName === recipientName) ||
    (recipientLocalPart && greetingName === recipientLocalPart);
  const showMismatch = !!greetingName && !greetingMatchesRecipient && !!recipient;

  return (
    <div
      className={cn(
        "group/draft mr-2 overflow-hidden rounded-lg border",
        showMismatch ? "border-amber-500/40" : "border-primary/20",
      )}
    >
      {/* Draft header — label + recipient + edit affordance */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-1.5",
          showMismatch ? "border-amber-500/10 bg-amber-500/5" : "border-primary/10 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium uppercase tracking-wider",
              showMismatch ? "text-amber-600/80" : "text-primary/70",
            )}
          >
            Draft reply
          </span>
          {recipient && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80 truncate">
              <CornerUpRight className="h-2.5 w-2.5 shrink-0 opacity-60" />
              <span className="truncate">
                to{" "}
                <span className="text-foreground/80 font-medium">
                  {recipient.name ?? recipient.email ?? recipient.label}
                </span>
                {recipient.email && recipient.name && (
                  <span className="text-muted-foreground/60"> &lt;{recipient.email}&gt;</span>
                )}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSent && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
              <Check className="h-3 w-3" />
              Sent
            </span>
          )}
          {!editing && !isSent && (
            <button
              onClick={beginEdit}
              title="Edit draft"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/draft:opacity-100"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mismatch warning */}
      {showMismatch && !editing && (
        <div className="flex items-start gap-2 border-b border-amber-500/10 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="flex-1">
            Greeting addresses <span className="font-medium">{greetingName}</span>,
            but Send will deliver to{" "}
            <span className="font-medium">{recipient?.name ?? recipient?.email}</span>.
            Edit the draft, or ask Dirac to compose a new email instead.
          </span>
        </div>
      )}

      {/* Draft body */}
      <div className="bg-muted/30 px-3 py-2.5">
        {editing ? (
          <textarea
            ref={editRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            className="w-full resize-none rounded-md border border-primary/40 bg-background px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
            rows={4}
          />
        ) : (
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
            {content}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={cn(
          "flex items-center gap-1.5 border-t px-3 py-1.5",
          showMismatch ? "border-amber-500/10 bg-amber-500/5" : "border-primary/10 bg-primary/5",
        )}
      >
        {editing ? (
          <>
            <span className="text-[10px] text-muted-foreground/60 mr-1">
              ⌘↵ save · Esc cancel
            </span>
            <button
              onClick={cancelEdit}
              className="ml-auto rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={commitEdit}
            >
              Save
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Compose Block ──────────────────────────────────────
//
// Renders an AI-proposed brand-new email with two action paths:
//   1. Send  — fires through the appropriate platform endpoint after a
//              short undo window. This is the keyboard-first happy path.
//   2. Open in Compose — punts to the floating ComposePanel for cases that
//              need attachments, CC/BCC, or heavy editing.
//
// First-contact protection is intentionally soft: rather than blocking
// the Send button, we show a "New recipient" warning and extend the undo
// window from 5s to 8s. The actual delay logic lives in handleSendCompose
// in the parent — we just reflect the resulting `sendState`.

function ComposeBlock({
  data,
  sendState,
  isNewContact,
  isValidRecipient,
  onOpen,
  onSend,
  onCancel,
  onOpenThread,
  onEdit,
}: {
  data: ComposeData;
  sendState: ComposeSendState | undefined;
  isNewContact: boolean;
  isValidRecipient: boolean;
  onOpen: () => void;
  onSend: () => void;
  onCancel: () => void;
  onOpenThread: (threadId?: string) => void;
  onEdit: (next: ComposeData) => void;
}) {
  const [opened, setOpened] = useState(false);

  // ─── Inline edit state ───────────────────────────────
  // We track a local working copy so the user can revise to/subject/body
  // without trashing the in-flight send state mid-typing. The new payload is
  // committed back via onEdit only on Save, which intentionally invalidates
  // any stale composeSends entry (the JSON.stringify key changes).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ComposeData>(data);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(data);
  }, [data, editing]);

  const beginEdit = () => {
    setDraft(data);
    setEditing(true);
    setTimeout(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, 0);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(data);
  };
  const commitEdit = () => {
    setEditing(false);
    const next: ComposeData = {
      to: draft.to.trim(),
      subject: draft.subject,
      body: draft.body,
    };
    if (next.to !== data.to || next.subject !== data.subject || next.body !== data.body) {
      onEdit(next);
    }
  };

  const handleOpen = () => {
    onOpen();
    setOpened(true);
  };

  // Drive the live countdown ticker while a send is pending.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sendState?.status !== "pending") return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [sendState?.status]);

  // ─── Sent state — collapsed receipt card ───────────────
  // Once the send goes through, the heavy preview collapses into a small
  // confirmation row. Keeps the chat scrollable and signals "done".
  if (sendState?.status === "sent") {
    return (
      <div className="mr-2 flex items-center justify-between gap-2 rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
          <span className="text-[12px] text-foreground/80 truncate">
            Sent to <span className="font-medium text-foreground">{sendState.to}</span>
            {data.subject && (
              <span className="text-muted-foreground"> · {data.subject}</span>
            )}
          </span>
        </div>
        <button
          onClick={() => onOpenThread(sendState.threadId)}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Open thread
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const isPending = sendState?.status === "pending";
  const isSending = sendState?.status === "sending";
  const isError = sendState?.status === "error";
  const remainingMs = isPending ? Math.max(0, sendState.sendAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const sendDisabled = !isValidRecipient || isPending || isSending;
  const sendTooltip = !data.to.trim()
    ? "Add a recipient before sending"
    : !isValidRecipient
      ? "Recipient looks invalid — open in compose to fix"
      : "";

  return (
    <div className={cn(
      "group/compose mr-2 overflow-hidden rounded-lg border transition-colors",
      isError ? "border-red-500/30" : isPending ? "border-amber-500/30" : "border-blue-500/20",
    )}>
      <div className={cn(
        "flex items-center justify-between border-b px-3 py-1.5",
        isError
          ? "border-red-500/10 bg-red-500/5"
          : isPending
            ? "border-amber-500/10 bg-amber-500/5"
            : "border-blue-500/10 bg-blue-500/5",
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            isError ? "text-red-600/70" : isPending ? "text-amber-600/70" : "text-blue-600/70",
          )}>
            New email
          </span>
          {isNewContact && data.to.trim() && !isError && (
            <span
              className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-amber-600/80 dark:text-amber-300/80"
              title="You haven't emailed this address before. Send delay is extended to 8s."
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              New recipient
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {opened && !sendState && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
              <Check className="h-3 w-3" />
              Opened
            </span>
          )}
          {!editing && !isPending && !isSending && (
            <button
              onClick={beginEdit}
              title="Edit email"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/compose:opacity-100"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-muted/30 px-3 py-2.5 space-y-1.5">
        {editing ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-muted-foreground">To</span>
              <input
                value={draft.to}
                onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                placeholder="recipient@example.com"
                className="w-full rounded-md border border-blue-500/30 bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Subject</span>
              <input
                value={draft.subject}
                onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className="w-full rounded-md border border-blue-500/30 bg-background px-2 py-1 text-[12px] font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <textarea
              ref={bodyRef}
              value={draft.body}
              onChange={(e) => {
                setDraft((p) => ({ ...p, body: e.target.value }));
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="mt-1 w-full resize-none rounded-md border border-blue-500/30 bg-background px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
              rows={5}
            />
          </>
        ) : (
          <>
            <div className="text-[11px]">
              <span className="text-muted-foreground">To: </span>
              <span className={cn(
                "text-foreground",
                !isValidRecipient && data.to.trim() && "text-red-600/80 dark:text-red-400/80",
                !data.to.trim() && "italic text-muted-foreground/70",
              )}>
                {data.to.trim() || "(no recipient yet)"}
              </span>
            </div>
            <div className="text-[11px]">
              <span className="text-muted-foreground">Subject: </span>
              <span className="text-foreground font-medium">{data.subject}</span>
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground pt-1 border-t border-border/50">
              {data.body}
            </div>
          </>
        )}
      </div>

      {/* Pending bar — countdown + Undo */}
      {isPending && (
        <div className="flex items-center justify-between gap-2 border-t border-amber-500/10 bg-amber-500/5 px-3 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-600" />
            <span className="text-[11px] text-amber-700 dark:text-amber-300">
              Sending in {remainingSec}s…
            </span>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10 hover:text-amber-900 transition-colors dark:text-amber-300 dark:hover:text-amber-100"
          >
            Undo
          </button>
        </div>
      )}

      {/* Error bar */}
      {isError && (
        <div className="flex items-start gap-2 border-t border-red-500/10 bg-red-500/5 px-3 py-1.5 text-[11px] text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="flex-1">Send failed: {sendState.message}</span>
        </div>
      )}

      {/* Action row — hidden during pending/sending so undo stays the focus */}
      {!isPending && !isSending && (
        <div className={cn(
          "flex items-center gap-1.5 border-t px-3 py-1.5",
          isError ? "border-red-500/10 bg-red-500/5" : "border-blue-500/10 bg-blue-500/5",
        )}>
          {editing ? (
            <>
              <span className="text-[10px] text-muted-foreground/60 mr-1">
                ⌘↵ save · Esc cancel
              </span>
              <button
                onClick={cancelEdit}
                className="ml-auto rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button
                size="sm"
                className="h-6 px-2.5 text-[11px]"
                onClick={commitEdit}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-6 gap-1 px-2.5 text-[11px]"
                onClick={onSend}
                disabled={sendDisabled}
                title={sendTooltip}
              >
                <Send className="h-3 w-3" />
                {isError ? "Retry send" : "Send"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
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
            </>
          )}
        </div>
      )}
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

const TRIAGE_LABELS: Record<string, string> = {
  needs_reply: "Needs reply",
  waiting_on: "Waiting on",
  fyi: "FYI",
  automated: "Automated",
};

const TRIAGE_COLORS: Record<string, string> = {
  needs_reply: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
  waiting_on:  "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  fyi:         "text-zinc-500 bg-zinc-500/10",
  automated:   "text-zinc-400 bg-zinc-500/8",
};

function ResultsBlock({
  items,
  onViewThread,
}: {
  items: ResultItem[];
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  return (
    <div className="mr-2 overflow-hidden rounded-xl border border-border/60">
      <div className="border-b border-border/50 bg-muted/40 px-3 py-1.5 flex items-center gap-1.5">
        <Mail className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {items.length} thread{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onViewThread(item.threadId, item.subject, item.from)}
            className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
          >
            {/* Urgency / avatar dot */}
            <div className={cn(
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              item.isUrgent ? "bg-rose-500" : "bg-muted-foreground/20",
            )} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="truncate text-[12px] font-medium text-foreground leading-snug">
                  {item.subject}
                </p>
                {item.isUrgent && (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 bg-rose-500/10">
                    Urgent
                  </span>
                )}
                {item.triage && TRIAGE_LABELS[item.triage] && !item.isUrgent && (
                  <span className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    TRIAGE_COLORS[item.triage] ?? "text-muted-foreground bg-muted",
                  )}>
                    {TRIAGE_LABELS[item.triage]}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                {item.from}
                {item.reason && (
                  <span className="text-muted-foreground/60"> · {item.reason}</span>
                )}
              </p>
            </div>

            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar Idle State (insight cards + suggestions) ────

import type {
  DiracThread,
  TriageCategory,
  FounderCategory,
  Commitment,
} from "@/lib/types";

function SidebarIdleState({
  threads,
  selectedThread,
  triageMap,
  categoryMap,
  topicMap,
  commitments,
  selectedThreadIds,
  onSuggestionClick,
  onInboxSuggestionClick,
}: {
  threads: DiracThread[];
  selectedThread: DiracThread | null;
  triageMap: Record<string, TriageCategory>;
  categoryMap: Record<string, FounderCategory>;
  topicMap: Record<string, TopicTag[]>;
  commitments: Commitment[];
  selectedThreadIds: Set<string>;
  onSuggestionClick: (prompt: string) => void;
  onInboxSuggestionClick: (prompt: string) => void;
}) {
  const [bulkCardIndex, setBulkCardIndex] = useState(0);
  const [aiSnapshot, setAiSnapshot] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const snapshotThreadIdRef = useRef<string | null>(null);

  const bulkThreads = threads.filter((t) => selectedThreadIds.has(t.id));
  const hasBulk = bulkThreads.length > 1;

  // Reset index when selection changes
  useEffect(() => {
    setBulkCardIndex(0);
  }, [selectedThreadIds.size]);

  const activeThread = hasBulk ? bulkThreads[bulkCardIndex] : selectedThread;

  const category = activeThread ? categoryMap[activeThread.id] : undefined;
  const topics = activeThread ? ((topicMap[activeThread.id] ?? []) as TopicTag[]) : [];
  const triage = activeThread ? triageMap[activeThread.id] : undefined;
  const threadCommitments = activeThread
    ? commitments.filter((c) => c.threadId === activeThread.id)
    : [];
  const sender = activeThread?.participants[0];

  // Fetch AI snapshot when thread changes
  useEffect(() => {
    if (!activeThread) { setAiSnapshot(null); return; }
    if (snapshotThreadIdRef.current === activeThread.id) return;
    snapshotThreadIdRef.current = activeThread.id;
    setAiSnapshot(null);
    setSnapshotLoading(true);

    const senderName = activeThread.participants[0]?.name ?? activeThread.participants[0]?.email ?? "";
    const prompt = `In 1-3 short, dense fragments (no full sentences needed), summarize what this email thread is actually about. Pack in: who it's from, the core topic, and any action required. Be extremely concise — think telegraph style.\n\nThread: "${activeThread.subject}"\nFrom: ${senderName}\nPreview: ${activeThread.snippet ?? ""}`;

    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt, preset: localStorage.getItem("dirac-ai-preset") || undefined }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }
        setAiSnapshot(text.trim().slice(0, 200));
      })
      .catch(() => {})
      .finally(() => setSnapshotLoading(false));
  }, [activeThread?.id]);


  const threadSuggestions = activeThread
    ? hasBulk
      ? [
          { label: `Summarize all ${bulkThreads.length}`, prompt: `Summarize these ${bulkThreads.length} threads: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. For each, give key points and action items.` },
          { label: "Prioritize these", prompt: `Rank these ${bulkThreads.length} threads by urgency: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. Which should I handle first and why?` },
          { label: "Draft batch replies", prompt: `Draft brief replies for each of these ${bulkThreads.length} threads: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. Keep each concise and in my tone.` },
        ]
      : [
          { label: "Summarize this thread", prompt: `Summarize the thread "${activeThread.subject}" — key points, action items, and what needs a response.` },
          { label: "Draft a reply", prompt: `Draft a reply to "${activeThread.subject}" in my tone. Keep it concise.` },
          { label: "What should I do next?", prompt: `For the thread "${activeThread.subject}", what is the best next move? Keep the answer short and practical.` },
        ]
    : [];

  const inboxSuggestions = [
    { label: "What needs my attention?", prompt: "What emails need my attention most urgently? Consider unread threads, anything awaiting my reply, and upcoming deadlines." },
    { label: "Summarize my inbox", prompt: "Give me a brief summary of my inbox — how many unread, what's urgent, and any patterns you notice." },
  ];

  const handleFlick = (direction: 1 | -1) => {
    setBulkCardIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return bulkThreads.length - 1;
      if (next >= bulkThreads.length) return 0;
      return next;
    });
  };

  return (
    <div className="relative flex flex-col gap-3 px-1 py-3 min-h-[400px]">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
        <div className="ai-orb ai-orb-1" />
        <div className="ai-orb ai-orb-2" />
        <div className="ai-orb ai-orb-3" />
      </div>

      {/* Bulk card stack OR single thread snapshot */}
      <AnimatePresence mode="wait">
        {hasBulk ? (
          <div key="bulk-stack" className="relative z-10 mx-1">
            {/* Stacked card shadows behind */}
            <div className="absolute inset-0 top-1 rounded-lg border border-border/30 bg-background/40 backdrop-blur-sm translate-x-1 translate-y-1" />
            {bulkThreads.length > 2 && (
              <div className="absolute inset-0 top-1 rounded-lg border border-border/20 bg-background/20 backdrop-blur-sm translate-x-2 translate-y-2" />
            )}

            {/* Active card */}
            <motion.div
              key={activeThread?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm p-3 ai-glow-card"
            >
              {/* Navigation header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                    <Inbox className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {bulkCardIndex + 1} / {bulkThreads.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleFlick(-1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </button>
                  <button
                    onClick={() => handleFlick(1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Card content */}
              {activeThread && (
                <ThreadCardContent
                  thread={activeThread}
                  category={category}
                  triage={triage}
                  topics={topics}
                  commitments={threadCommitments}
                  sender={sender}
                />
              )}
            </motion.div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1 mt-2">
              {bulkThreads.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setBulkCardIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === bulkCardIndex
                      ? "w-4 bg-primary"
                      : "w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
          </div>
        ) : activeThread ? (
          <motion.div
            key={activeThread.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-10 mx-1 rounded-lg border border-border/60 bg-background/80 backdrop-blur-sm p-3 ai-glow-card"
          >
            <ThreadCardContent
              thread={activeThread}
              category={category}
              triage={triage}
              topics={topics}
              commitments={threadCommitments}
              sender={sender}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {activeThread && (
        <div className="relative z-10 mx-1 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1.5">
            Thread snapshot
          </p>
          {snapshotLoading && !aiSnapshot && (
            <div className="space-y-1.5 animate-pulse mt-0.5">
              <div className="h-2.5 w-full rounded-md bg-muted/70" />
              <div className="h-2.5 w-4/5 rounded-md bg-muted/55" />
              <div className="h-2.5 w-3/5 rounded-md bg-muted/40" />
            </div>
          )}
          {aiSnapshot && (
            <p className="text-[12px] leading-[1.55] text-foreground/90 whitespace-pre-wrap">{aiSnapshot}</p>
          )}
        </div>
      )}

      {/* Suggestion chips — thread-specific */}
      {activeThread && (
        <div className="relative z-10 flex flex-col gap-1 mt-1">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-0.5"
          >
            Quick help
          </motion.p>
          {threadSuggestions.map((chip, i) => (
            <motion.button
              key={chip.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.1 + i * 0.04 }}
              onClick={() => onSuggestionClick(chip.prompt)}
              className="ai-chip-shimmer flex items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-accent/60"
            >
              <ArrowRight className="h-3 w-3 shrink-0 text-primary/40" />
              {chip.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Suggestion chips — general / inbox */}
      <div className="relative z-10 flex flex-col gap-1 mt-1">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: activeThread ? 0.35 : 0.15 }}
          className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-0.5"
        >
          Inbox-wide
        </motion.p>
        {inboxSuggestions.map((chip, i) => (
          <motion.button
            key={chip.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: (activeThread ? 0.35 : 0.1) + i * 0.04 }}
            onClick={() => onInboxSuggestionClick(chip.prompt)}
            className="ai-chip-shimmer flex items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            {chip.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Thread card content (shared between single + bulk) ──

function ThreadCardContent({
  thread,
  category,
  triage,
  topics,
  commitments: threadCommitments,
  sender,
}: {
  thread: DiracThread;
  category?: FounderCategory;
  triage?: TriageCategory;
  topics: TopicTag[];
  commitments: Commitment[];
  sender?: { name: string; email: string };
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent shrink-0">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground truncate">
            {sender?.name ?? sender?.email ?? "Unknown"}
          </p>
          {sender?.email && sender.name && (
            <p className="text-[10px] text-muted-foreground/60 truncate">{sender.email}</p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-foreground font-medium truncate mb-2 pl-7">
        {thread.subject}
      </p>

      {(category || triage || topics.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {category && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", FOUNDER_CATEGORY_COLORS[category])}>
              {FOUNDER_CATEGORY_LABELS[category]}
            </span>
          )}
          {triage === "needs_reply" && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              Needs reply
            </span>
          )}
          {triage === "waiting_on" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Waiting on
            </span>
          )}
          {topics.map((tag) => (
            <span
              key={tag}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium leading-none", TOPIC_TAG_COLORS[tag] ?? "text-muted-foreground bg-muted")}
            >
              {TOPIC_TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}</span>
        <span>&middot;</span>
        <span>{formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}</span>
      </div>

      {threadCommitments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1">
            {threadCommitments.length} commitment{threadCommitments.length !== 1 ? "s" : ""}
          </p>
          {threadCommitments.slice(0, 2).map((c) => (
            <p key={c.id} className={cn("text-[10px] truncate", c.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {c.owner === "me" ? "You" : "They"}: {c.description}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
