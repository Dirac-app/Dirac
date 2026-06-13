"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { signIn, useSession } from "next-auth/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppContext, type AppState, type AiContextItem, type ToneProfile, type Clip } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useUndoSystem, type UndoableActionType, getUndoLabel } from "@/lib/undo";
import type {
  DiracThread,
  DiracMessage,
  InboxFilter,
  TriageCategory,
  FounderCategory,
  CategoryTab,
  Commitment,
  SnoozeState,
  RelationshipContext,
  PatternSuggestion,
  TopicTag,
} from "@/lib/types";
import { TAB_COLORS } from "@/lib/types";
import { mergeSenderStatsFromThreads } from "@/lib/sender-stats";
import {
  loadSenderAiCategories,
  saveSenderAiCategories,
} from "@/lib/sender-categories";
import { preclassifyEmail } from "@/lib/sender-classify";
import {
  loadSenderOverrides,
  matchSenderOverride,
  SENDER_OVERRIDES_CHANGED_EVENT,
  type SenderOverride,
} from "@/lib/sender-overrides";

// ─── Local storage helpers for starred / urgent state ────

const STARRED_KEY = "dirac_starred";
const URGENT_KEY = "dirac_urgent_manual";
const URGENT_DISMISSED_KEY = "dirac_urgent_dismissed";
const TONE_KEY = "dirac_tone_profile";
const SNOOZED_KEY = "dirac_snoozed";
const DONE_KEY = "dirac_done";
const COMMITMENTS_KEY = "dirac_commitments";
const CATEGORIES_KEY = "dirac_categories";
const PATTERNS_KEY = "dirac_patterns";
const TOPICS_KEY = "dirac_topics";

function loadSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {}
}

function loadStarred(): Set<string> {
  return loadSet(STARRED_KEY);
}

function saveStarred(ids: Set<string>) {
  saveSet(STARRED_KEY, ids);
}

// ─── Provider ───────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: session, status: nextAuthStatus } = useSession();
  const { toast } = useToast();

  // Supabase session without Gmail: one NextAuth sign-in (Gmail scopes) links the inbox.
  useEffect(() => {
    if (nextAuthStatus !== "unauthenticated") return;
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/signup")) return;

    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      if (!supabaseSession) return;
      const returnPath = window.location.pathname + window.location.search;
      void signIn("google", {
        callbackUrl: `/auth/complete?next=${encodeURIComponent(returnPath || "/inbox")}`,
      });
    });
  }, [nextAuthStatus]);

  // Undo system for thread actions
  const {
    pushAction: pushUndoAction,
    undo: performUndo,
    undoStack,
    currentUndo,
    dismissUndo,
    getCurrentUndo,
    timeLeft,
  } = useUndoSystem();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);

  // Tone profile (persisted in localStorage)
  const [toneProfile, setToneProfileState] = useState<ToneProfile | null>(null);

  const setToneProfile = useCallback((profile: ToneProfile | null) => {
    setToneProfileState(profile);
    try {
      if (profile) {
        localStorage.setItem(TONE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(TONE_KEY);
      }
    } catch {}
  }, []);

  // Triage categories (AI-classified)
  const [triageMap, setTriageMap] = useState<Record<string, TriageCategory>>({});
  const [triageLoading, setTriageLoading] = useState(false);

  // Thread list state (per-platform, merged for display)
  const [gmailThreads, setGmailThreads] = useState<DiracThread[]>([]);
  const [outlookThreads, setOutlookThreads] = useState<DiracThread[]>([]);
  const [discordThreads, setDiscordThreads] = useState<DiracThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState(false);
  const [gmailNextPageToken, setGmailNextPageToken] = useState<string | undefined>(undefined);

  // Starred IDs (persisted in localStorage, seeded from Gmail STARRED label)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Urgent IDs (AI-detected + manually toggled + dismissed)
  const [urgentIds, setUrgentIds] = useState<Set<string>>(new Set());
  const [manualUrgentIds, setManualUrgentIds] = useState<Set<string>>(new Set());
  const [dismissedUrgentIds, setDismissedUrgentIds] = useState<Set<string>>(new Set());

  // Fetch thread metadata from DB on mount and merge with localStorage state
  useEffect(() => {
    async function fetchMetadataFromDb() {
      try {
        const res = await fetch("/api/threads/metadata");
        if (!res.ok) return;
        const data = await res.json();
        const rows: { threadId: string; status: string; tags: string[]; urgencyScore: number | null; isPinned: boolean }[] =
          data.metadata ?? [];

        // Merge: DB is source of truth for starred (isPinned) and urgency
        if (rows.length > 0) {
          const dbStarredIds = new Set(
            rows.filter((r) => r.isPinned).map((r) => r.threadId),
          );
          if (dbStarredIds.size > 0) {
            setStarredIds((prev) => {
              const next = new Set([...prev, ...dbStarredIds]);
              saveStarred(next);
              return next;
            });
          }
        }
      } catch {
        // Non-critical — localStorage is the fallback
      }
    }
    fetchMetadataFromDb();
  }, []);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setStarredIds(loadStarred());
    setManualUrgentIds(loadSet(URGENT_KEY));
    setDismissedUrgentIds(loadSet(URGENT_DISMISSED_KEY));
    try {
      const raw = localStorage.getItem(TONE_KEY);
      if (raw) setToneProfileState(JSON.parse(raw));
    } catch {}
    try {
      const s = localStorage.getItem(SNOOZED_KEY);
      if (s) setSnoozedThreads(JSON.parse(s));
    } catch {}
    try {
      const d = localStorage.getItem(DONE_KEY);
      if (d) setDoneThreadIds(new Set(JSON.parse(d)));
    } catch {}
    try {
      const c = localStorage.getItem(COMMITMENTS_KEY);
      if (c) setCommitmentsState(JSON.parse(c));
    } catch {}
    try {
      const cat = localStorage.getItem(CATEGORIES_KEY);
      if (cat) setCategoryMap(JSON.parse(cat));
    } catch {}
    // Sender overrides — hydrate once on mount; a separate effect listens
    // for updates so the rule list stays live across tabs and from the
    // settings page without requiring a refresh.
    setSenderOverrides(loadSenderOverrides());
    try {
      const tabs = localStorage.getItem("dirac-category-tabs");
      if (tabs) setCategoryTabsState(JSON.parse(tabs));
    } catch {}
    try {
      const tabMap = localStorage.getItem("dirac-category-tab-map");
      if (tabMap) setCategoryTabMap(JSON.parse(tabMap));
    } catch {}
    try {
      const p = localStorage.getItem(PATTERNS_KEY);
      if (p) setPatternSuggestions(JSON.parse(p));
    } catch {}
    try {
      const tp = localStorage.getItem(TOPICS_KEY);
      if (tp) setTopicMap(JSON.parse(tp));
    } catch {}
  }, []);

  // Keep senderOverrides live. Fires from settings UI (same tab → custom event)
  // and from other tabs (→ native storage event).
  useEffect(() => {
    const refresh = () => setSenderOverrides(loadSenderOverrides());
    window.addEventListener(SENDER_OVERRIDES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SENDER_OVERRIDES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Merged + sorted threads with starred/urgent overlays
  const threads = useMemo(() => {
    const all = [...gmailThreads, ...outlookThreads, ...discordThreads];
    return all
      .map((t) => {
        const dismissed = dismissedUrgentIds.has(t.id);
        return {
          ...t,
          isStarred: t.isStarred || starredIds.has(t.id),
          isUrgent: dismissed
            ? false
            : t.isUrgent || urgentIds.has(t.id) || manualUrgentIds.has(t.id),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
  }, [gmailThreads, outlookThreads, discordThreads, starredIds, urgentIds, manualUrgentIds, dismissedUrgentIds]);

  // Connection statuses
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);

  // Messages for selected thread
  const [messages, setMessages] = useState<DiracMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // AI context
  const [aiContext, setAiContext] = useState<AiContextItem[]>([]);

  // AI query handoff (spotlight → sidebar)
  const [pendingAiQuery, setPendingAiQuery] = useState<string | null>(null);

  // ─── Thread lifecycle (Direction A) ─────────────────────
  const [snoozedThreads, setSnoozedThreads] = useState<SnoozeState[]>([]);
  const [doneThreadIds, setDoneThreadIds] = useState<Set<string>>(new Set());
  const [commitments, setCommitmentsState] = useState<Commitment[]>([]);

  // ─── Founder categories (Direction B) ───────────────────
  const [categoryMap, setCategoryMap] = useState<Record<string, FounderCategory>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);
  // User-configured sender rules (settings → Sender rules). These shortcut the
  // AI classifier when a thread's sender matches a rule.
  const [senderOverrides, setSenderOverrides] = useState<SenderOverride[]>([]);

  // ─── Dynamic category tabs ────────────────────────────
  const [categoryTabMap, setCategoryTabMap] = useState<Record<string, string>>({});
  const [categoryTabs, setCategoryTabsState] = useState<CategoryTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const TABS_KEY = "dirac-category-tabs";
  const TAB_MAP_KEY = "dirac-category-tab-map";

  // ─── Pattern suggestions (Direction B.3) ────────────────
  const [patternSuggestions, setPatternSuggestions] = useState<PatternSuggestion[]>([]);

  // ─── Topic tags (AI-generated) ──────────────────────────
  const [topicMap, setTopicMap] = useState<Record<string, TopicTag[]>>({});
  const [topicLoading, setTopicLoading] = useState(false);

  // ─── Set aside ────────────────────────────────────────
  const [setAsideThreadIds, setSetAsideThreadIds] = useState<string[]>([]);
  const addToSetAside = useCallback((ids: string[]) => {
    setSetAsideThreadIds(prev => Array.from(new Set([...prev, ...ids])));
  }, []);
  const removeFromSetAside = useCallback((id: string) => {
    setSetAsideThreadIds(prev => prev.filter(t => t !== id));
  }, []);
  const clearSetAside = useCallback(() => setSetAsideThreadIds([]), []);

  // ─── View all overlay ─────────────────────────────────
  const [viewAllThreadIds, setViewAllThreadIds] = useState<string[]>([]);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const openViewAll = useCallback((ids: string[]) => {
    setViewAllThreadIds(ids);
    setViewAllOpen(true);
  }, []);
  const closeViewAll = useCallback(() => setViewAllOpen(false), []);

  // ─── Clip library ────────────────────────────────────
  const CLIPS_KEY = "dirac-clips";
  const [clips, setClips] = useState<Clip[]>(() => {
    try { return JSON.parse(localStorage.getItem(CLIPS_KEY) ?? "[]"); } catch { return []; }
  });
  const addClip = useCallback((clip: Omit<Clip, "id" | "createdAt">) => {
    const next: Clip = { ...clip, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setClips(prev => {
      const updated = [next, ...prev];
      try { localStorage.setItem(CLIPS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);
  const removeClip = useCallback((id: string) => {
    setClips(prev => {
      const updated = prev.filter(c => c.id !== id);
      try { localStorage.setItem(CLIPS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // ─── QoL state ────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [density, setDensityState] = useState<"compact" | "comfortable">("comfortable");
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  const setDensity = useCallback((d: "compact" | "comfortable") => {
    setDensityState(d);
    try { localStorage.setItem("dirac_density", d); } catch {}
  }, []);

  // Load density from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dirac_density");
      if (saved === "compact" || saved === "comfortable") setDensityState(saved);
    } catch {}
  }, []);

  const toggleBulkSelect = useCallback((id: string) => {
    setSelectedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedThreadIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedThreadIds(new Set());
  }, []);

  // ─── Toggle starred ───────────────────────────────────
  const toggleStarred = useCallback((threadId: string, skipUndo?: boolean) => {
    // Find thread for undo tracking
    const thread = threads.find(t => t.id === threadId);
    const threadSubject = thread?.subject;
    const wasStarred = thread?.isStarred || starredIds.has(threadId);
    
    // Determine action type
    const actionType = wasStarred ? "unstar" : "star";
    
    setStarredIds((prev) => {
      const next = new Set(prev);
      const nowStarred = !next.has(threadId);
      if (nowStarred) {
        next.add(threadId);
      } else {
        next.delete(threadId);
      }
      saveStarred(next);
      // Persist to DB (fire-and-forget)
      fetch("/api/threads/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [{ threadId, isPinned: nowStarred }],
        }),
      }).catch(() => {});
      return next;
    });
    
    // Show toast with undo (skip when called from the undo handler itself)
    if (!skipUndo) {
      pushUndoAction({
        type: actionType,
        threadId,
        threadSubject,
      });
    }
  }, [threads, starredIds, pushUndoAction]);

  // ─── Toggle urgent ──────────────────────────────────
  const toggleUrgent = useCallback((threadId: string) => {
    // Check if thread is currently urgent (from any source)
    const isCurrentlyUrgent =
      urgentIds.has(threadId) ||
      manualUrgentIds.has(threadId);

    if (isCurrentlyUrgent) {
      // Removing urgency: add to dismissed so AI won't re-flag it
      setDismissedUrgentIds((prev) => {
        const next = new Set(prev);
        next.add(threadId);
        saveSet(URGENT_DISMISSED_KEY, next);
        return next;
      });
      setManualUrgentIds((prev) => {
        if (!prev.has(threadId)) return prev;
        const next = new Set(prev);
        next.delete(threadId);
        saveSet(URGENT_KEY, next);
        return next;
      });
      setUrgentIds((prev) => {
        if (!prev.has(threadId)) return prev;
        const next = new Set(prev);
        next.delete(threadId);
        return next;
      });
      // Persist to DB (fire-and-forget)
      fetch("/api/threads/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [{ threadId, urgencyScore: 0 }] }),
      }).catch(() => {});
    } else {
      // Adding urgency: remove from dismissed, add to manual
      setDismissedUrgentIds((prev) => {
        if (!prev.has(threadId)) return prev;
        const next = new Set(prev);
        next.delete(threadId);
        saveSet(URGENT_DISMISSED_KEY, next);
        return next;
      });
      setManualUrgentIds((prev) => {
        const next = new Set(prev);
        next.add(threadId);
        saveSet(URGENT_KEY, next);
        return next;
      });
      // Persist to DB (fire-and-forget)
      fetch("/api/threads/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [{ threadId, urgencyScore: 100 }] }),
      }).catch(() => {});
    }
  }, [urgentIds, manualUrgentIds]);

  // ─── Mark thread as unread (optimistic + API) ──────
  const markThreadUnread = useCallback(
    (threadId: string) => {
      // Only the ID is available here; use prefix as platform hint
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");

      // Optimistic update
      if (isOutlook) {
        setOutlookThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, isUnread: true } : t)),
        );
      } else if (!isDiscord) {
        setGmailThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, isUnread: true } : t)),
        );
      }

      // Deselect if currently selected (mimics closing it)
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }

      // API call (fire-and-forget)
      if (!isDiscord) {
        const apiUrl = isOutlook
          ? `/api/outlook/threads/${threadId}`
          : `/api/gmail/threads/${threadId}`;
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark-unread" }),
        }).catch(() => {});
      }
    },
    [selectedThreadId],
  );

  // ─── Mark thread as read (optimistic + API) ────────
  const markThreadRead = useCallback((threadId: string, skipUndo?: boolean) => {
    // Only the ID is available here; use prefix as platform hint
    const isOutlook = threadId.startsWith("outlook-");
    const isDiscord = threadId.startsWith("discord-");
    
    // Find thread for undo tracking
    const thread = threads.find(t => t.id === threadId);
    const threadSubject = thread?.subject;

    if (isOutlook) {
      setOutlookThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isUnread: false } : t)),
      );
    } else if (!isDiscord) {
      setGmailThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isUnread: false } : t)),
      );
    }

    if (!isDiscord) {
      const apiUrl = isOutlook
        ? `/api/outlook/threads/${threadId}`
        : `/api/gmail/threads/${threadId}`;
      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read" }),
      }).catch(() => {});
    }
    
    // Show toast with undo (skip when called from the undo handler itself)
    if (!skipUndo) {
      pushUndoAction({
        type: "markRead",
        threadId,
        threadSubject,
      });
    }
  }, [threads, pushUndoAction]);

  // ─── Archive thread (optimistic remove + API) ──────
  const archiveThread = useCallback(
    (threadId: string, skipUndo?: boolean) => {
      // Only the ID is available here; use prefix as platform hint
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");
      
      // Capture full thread for undo restore
      const thread = threads.find(t => t.id === threadId);
      const threadSubject = thread?.subject;

      // Remove from list optimistically
      if (isOutlook) {
        setOutlookThreads((prev) => prev.filter((t) => t.id !== threadId));
      } else if (!isDiscord) {
        setGmailThreads((prev) => prev.filter((t) => t.id !== threadId));
      }

      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }

      if (!isDiscord) {
        const apiUrl = isOutlook
          ? `/api/outlook/threads/${threadId}`
          : `/api/gmail/threads/${threadId}`;
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        }).catch(() => {});
      }
      
      if (!skipUndo) {
        // Store full thread in metadata so undo can re-insert it
        pushUndoAction({
          type: "archive",
          threadId,
          threadSubject,
          metadata: { thread },
        });
      }
    },
    [selectedThreadId, toast, pushUndoAction, threads],
  );

  // ─── Unarchive thread (undo for archive) ───────────
  const unarchiveThread = useCallback(
    (threadId: string, thread?: DiracThread) => {
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");

      // Re-insert optimistically using the captured snapshot
      if (thread) {
        if (isOutlook) {
          setOutlookThreads((prev) => {
            if (prev.some(t => t.id === threadId)) return prev;
            return [thread, ...prev];
          });
        } else if (!isDiscord) {
          setGmailThreads((prev) => {
            if (prev.some(t => t.id === threadId)) return prev;
            return [thread, ...prev];
          });
        }
      }

      if (!isDiscord) {
        const apiUrl = isOutlook
          ? `/api/outlook/threads/${threadId}`
          : `/api/gmail/threads/${threadId}`;
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unarchive" }),
        }).catch(() => {});
      }
    },
    [],
  );

  // ─── Trash thread (optimistic remove + API) ────────
  const trashThread = useCallback(
    (threadId: string) => {
      // Only the ID is available here; use prefix as platform hint
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");
      
      // Capture full thread for undo restore
      const thread = threads.find(t => t.id === threadId);
      const threadSubject = thread?.subject;

      if (isOutlook) {
        setOutlookThreads((prev) => prev.filter((t) => t.id !== threadId));
      } else if (!isDiscord) {
        setGmailThreads((prev) => prev.filter((t) => t.id !== threadId));
      }

      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }

      if (!isDiscord) {
        const apiUrl = isOutlook
          ? `/api/outlook/threads/${threadId}`
          : `/api/gmail/threads/${threadId}`;
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trash" }),
        }).catch(() => {});
      }
      
      // Store full thread in metadata so undo can re-insert it
      pushUndoAction({
        type: "trash",
        threadId,
        threadSubject,
        metadata: { thread },
      });
    },
    [selectedThreadId, toast, pushUndoAction, threads],
  );

  // ─── Untrash thread (undo for trash) ───────────────
  const untrashThread = useCallback(
    (threadId: string, thread?: DiracThread) => {
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");

      // Re-insert optimistically using the captured snapshot
      if (thread) {
        if (isOutlook) {
          setOutlookThreads((prev) => {
            if (prev.some(t => t.id === threadId)) return prev;
            return [thread, ...prev];
          });
        } else if (!isDiscord) {
          setGmailThreads((prev) => {
            if (prev.some(t => t.id === threadId)) return prev;
            return [thread, ...prev];
          });
        }
      }

      if (!isDiscord) {
        const apiUrl = isOutlook
          ? `/api/outlook/threads/${threadId}`
          : `/api/gmail/threads/${threadId}`;
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "untrash" }),
        }).catch(() => {});
      }
    },
    [],
  );

  // ─── AI context helpers ───────────────────────────────
  const addToAiContext = useCallback((item: AiContextItem) => {
    setAiContext((prev) => {
      if (prev.some((c) => c.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeFromAiContext = useCallback((id: string) => {
    setAiContext((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const toggleAiContext = useCallback((item: AiContextItem) => {
    setAiContext((prev) => {
      if (prev.some((c) => c.id === item.id)) {
        return prev.filter((c) => c.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  const clearAiContext = useCallback(() => {
    setAiContext([]);
  }, []);

  const isInAiContext = useCallback(
    (id: string) => aiContext.some((c) => c.id === id),
    [aiContext],
  );

  // ─── Snooze helpers (Direction A.2) ─────────────────────
  const snoozeThread = useCallback(
    (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">, skipUndo?: boolean) => {
      const thread = threads.find(t => t.id === threadId);
      const threadSubject = thread?.subject;
      setSnoozedThreads((prev) => {
        const next = [
          ...prev.filter((s) => s.threadId !== threadId),
          { ...snooze, threadId, snoozedAt: new Date().toISOString() },
        ];
        try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      if (selectedThreadId === threadId) setSelectedThreadId(null);
      if (!skipUndo) {
        pushUndoAction({ type: "snooze", threadId, threadSubject });
      }
    },
    [selectedThreadId, threads, pushUndoAction],
  );

  const unsnoozeThread = useCallback((threadId: string) => {
    const snoozeState = snoozedThreads.find(s => s.threadId === threadId);
    setSnoozedThreads((prev) => {
      const next = prev.filter((s) => s.threadId !== threadId);
      try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    if (snoozeState) {
      pushUndoAction({ type: "unsnooze", threadId, metadata: { snooze: snoozeState } });
    }
  }, [snoozedThreads, pushUndoAction]);

  useEffect(() => {
    const checkSnoozes = () => {
      const now = Date.now();
      setSnoozedThreads((prev) => {
        const expired = prev.filter(
          (s) => s.mode === "time" && s.until && new Date(s.until).getTime() <= now,
        );
        if (expired.length === 0) return prev;
        const next = prev.filter(
          (s) => !(s.mode === "time" && s.until && new Date(s.until).getTime() <= now),
        );
        try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    checkSnoozes();
    const interval = setInterval(checkSnoozes, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── Done helpers (Direction A.1) ───────────────────────
  const markDone = useCallback((threadId: string, skipUndo?: boolean) => {
    const thread = threads.find(t => t.id === threadId);
    const threadSubject = thread?.subject;
    setDoneThreadIds((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      try { localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
    if (!skipUndo) {
      pushUndoAction({ type: "markDone", threadId, threadSubject });
    }
  }, [threads, pushUndoAction]);

  const unmarkDone = useCallback((threadId: string) => {
    setDoneThreadIds((prev) => {
      const next = new Set(prev);
      next.delete(threadId);
      try { localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  // ─── Commitments helpers (Direction A.3) ────────────────
  const setCommitments = useCallback((c: Commitment[]) => {
    setCommitmentsState(c);
    try { localStorage.setItem(COMMITMENTS_KEY, JSON.stringify(c)); } catch {}
  }, []);

  const dismissCommitment = useCallback((id: string) => {
    setCommitmentsState((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try { localStorage.setItem(COMMITMENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ─── Founder categories (Direction B.1) ─────────────────

  const setCategoryTabs = useCallback((tabs: CategoryTab[]) => {
    setCategoryTabsState(tabs);
    try { localStorage.setItem("dirac-category-tabs", JSON.stringify(tabs)); } catch {}
  }, []);

  // Deterministic pre-rules run client-side before the AI call.
  // These patterns are so reliable that they don't need AI.
  // Stable team domain derived from the signed-in user's email
  const PUBLIC_DOMAINS_SET = useMemo(() => new Set([
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com",
    "mac.com", "proton.me", "protonmail.com", "aol.com", "zoho.com",
  ]), []);
  const teamDomain = useMemo(() => {
    const raw = session?.user?.email?.split("@")[1]?.toLowerCase() ?? "";
    return PUBLIC_DOMAINS_SET.has(raw) ? "" : raw;
  }, [session?.user?.email, PUBLIC_DOMAINS_SET]);

  // Subject-line only signals (used when we have thread subject data)
  const preclassifyBySubject = useCallback((subject: string): FounderCategory | null => {
    const subj = subject.toLowerCase();
    const automatedSubjectPatterns = [
      "unsubscribe", "weekly digest", "daily digest", "monthly digest",
      "issue #", "issue no.", "newsletter", "you have a new message",
      "build failed", "build succeeded", "deployment failed", "deployment succeeded",
      "ci failed", "ci passed", "pipeline failed", "pipeline passed",
      "your order", "order confirmation", "tracking number", "your receipt",
      "invoice from", "payment receipt", "payment confirmation",
      "your account", "verify your", "confirm your email",
      "security alert", "sign-in attempt", "new login",
    ];
    return automatedSubjectPatterns.some((p) => subj.includes(p)) ? "automated" : null;
  }, []);

  // Full preclassify: email rules (from lib) + subject rules + manual overrides
  const preclassify = useCallback((email: string, subject: string): FounderCategory | null => {
    const addr = email.toLowerCase();
    const manual = matchSenderOverride(addr, senderOverrides);
    if (manual) return manual;
    return preclassifyEmail(addr, teamDomain || undefined) ?? preclassifyBySubject(subject);
  }, [senderOverrides, teamDomain, preclassifyBySubject]);

  const runCategorization = useCallback(async () => {
    const allThreads = [...gmailThreads, ...outlookThreads];
    if (allThreads.length === 0) return;
    setCategoryLoading(true);
    // Derive team domain from logged-in user's email (e.g. "acme.com")
    // Public email providers — never treat these as a "team domain"
    try {
      // Load the sender-level category cache — one entry covers all threads from that sender.
      // This means we never call AI twice for the same person, even across sessions.
      const senderAiCats = loadSenderAiCategories();

      // ── One-time migration: bootstrap sender cache from existing per-thread data ──
      // Users who had threads categorized before sender-level caching existed will
      // have data in categoryMap (thread→category) but nothing in senderAiCats.
      // Mine that existing data now so past senders are immediately categorized.
      let migrated = false;
      for (const t of allThreads) {
        const senderEmail = (t.participants[0]?.email ?? "").toLowerCase();
        if (senderEmail && !senderAiCats[senderEmail] && categoryMap[t.id]) {
          senderAiCats[senderEmail] = categoryMap[t.id];
          migrated = true;
        }
      }
      if (migrated) saveSenderAiCategories(senderAiCats);

      const map: Record<string, FounderCategory> = { ...categoryMap };
      const tabMap: Record<string, string> = { ...categoryTabMap };

      // ── Pass 1: rule-based preclassification + cache lookup ────────────────
      // We iterate ALL threads (not just 40) so every loaded thread gets a
      // category, including threads from already-known senders.
      const needsAiByEmail = new Map<string, typeof allThreads[0]>(); // one representative thread per new sender

      for (const t of allThreads) {
        const senderEmail = (t.participants[0]?.email ?? "").toLowerCase();
        const pre = preclassify(senderEmail, t.subject);

        if (pre) {
          // Rule-based hit (automated, team, etc.) — instant, no AI needed
          map[t.id] = pre;
          if (!senderAiCats[senderEmail]) senderAiCats[senderEmail] = pre;
        } else if (senderAiCats[senderEmail]) {
          // Already classified in a previous session — reuse directly
          map[t.id] = senderAiCats[senderEmail];
        } else {
          // New sender — queue one representative thread per email for AI
          if (!needsAiByEmail.has(senderEmail)) {
            needsAiByEmail.set(senderEmail, t);
          }
          // Don't assign map[t.id] yet — will be filled after AI responds
        }
      }

      // ── Pass 1b: pre-classify tabs for all threads ─────────────────────────
      for (const t of allThreads) {
        if (teamDomain && t.participants[0]?.email?.endsWith(`@${teamDomain}`)) {
          tabMap[t.id] = "team";
          continue;
        }
        if (map[t.id] === "automated") {
          const addr = (t.participants[0]?.email ?? "").toLowerCase();
          const subj = t.subject.toLowerCase();

          if (["github", "gitlab", "bitbucket", "vercel", "netlify", "heroku", "railway", "render", "circleci", "jenkins"].some(s => addr.includes(s))
            || ["build", "deploy", "pipeline", "ci ", "ci/cd", "preview"].some(s => subj.includes(s))) {
            tabMap[t.id] = "builds & deploys";
          } else if (["stripe", "paypal", "mercury", "brex", "invoice", "receipt", "billing", "payment"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "receipts";
          } else if (["security", "login", "verify", "password", "2fa", "authentication", "sign-in"].some(s => subj.includes(s))) {
            tabMap[t.id] = "security";
          } else if (["instagram", "twitter", "facebook", "linkedin", "tiktok", "youtube", "threads", "mastodon"].some(s => addr.includes(s))) {
            tabMap[t.id] = "social";
          } else if (["newsletter", "digest", "weekly", "unsubscribe", "indiehackers", "morningbrew", "substack", "mailchimp", "beehiiv"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "newsletters";
          } else if (["sentry", "datadog", "pagerduty", "alert", "monitoring", "uptime", "incident"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "alerts";
          } else {
            tabMap[t.id] = "notifications";
          }
        }
      }

      // ── Pass 2: AI classification for new senders only ─────────────────────
      // We send one representative thread per new sender (max 30 unique senders
      // per run). The result is saved at the sender level and propagated to ALL
      // threads from that sender — including future thread loads.
      const newSenderThreads = Array.from(needsAiByEmail.values()).slice(0, 30);

      if (newSenderThreads.length > 0) {
        const summaries = newSenderThreads.map((t) => ({
          threadId: t.id,
          subject: t.subject,
          snippet: t.snippet ?? "",
          from: t.participants[0]?.email ?? "",
          fromName: t.participants[0]?.name ?? "",
          messageCount: t.messageCount,
          participantCount: t.participants.length,
          isForward: /^(fwd?|fw)\s*:/i.test(t.subject),
        }));

        const existingTabNames = categoryTabs.map(tab => tab.label.toLowerCase());
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threads: summaries, teamDomain, existingTabs: existingTabNames }),
        });

        if (res.ok) {
          const data = await res.json();
          // Build a threadId → {category, tab} lookup from AI response
          const aiResultByThread = new Map<string, { category: FounderCategory; tab?: string }>();
          for (const r of data.results ?? []) {
            if (r.threadId && r.category) {
              aiResultByThread.set(r.threadId, { category: r.category, tab: r.tab });
            }
          }

          // Save category at the sender level, then propagate to ALL their threads
          for (const [senderEmail, repThread] of needsAiByEmail) {
            const result = aiResultByThread.get(repThread.id);
            if (!result) continue;

            senderAiCats[senderEmail] = result.category;

            // Apply to every thread from this sender in the current batch
            for (const t of allThreads) {
              const addr = (t.participants[0]?.email ?? "").toLowerCase();
              if (addr === senderEmail) {
                map[t.id] = result.category;
                if (result.tab) tabMap[t.id] = result.tab.toLowerCase().trim();
              }
            }
          }
        }
      }

      // Persist sender-level categories so future loads skip AI for known senders
      saveSenderAiCategories(senderAiCats);

      setCategoryMap(map);
      setCategoryTabMap(tabMap);
      try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(map)); } catch {}
      try { localStorage.setItem("dirac-category-tab-map", JSON.stringify(tabMap)); } catch {}

      // Auto-discover tabs from tabMap: count threads per tab, create CategoryTab for each
      const tabCounts: Record<string, number> = {};
      for (const tabId of Object.values(tabMap)) {
        tabCounts[tabId] = (tabCounts[tabId] ?? 0) + 1;
      }

      // Merge with existing user-customized tabs
      const existingById = new Map(categoryTabs.map(t => [t.id, t]));
      const newTabs: CategoryTab[] = [];
      const sortedTabIds = Object.entries(tabCounts)
        .sort((a, b) => b[1] - a[1]); // most threads first

      for (const [tabId, _count] of sortedTabIds) {
        const existing = existingById.get(tabId);
        if (existing) {
          newTabs.push(existing);
          existingById.delete(tabId);
        } else {
          newTabs.push({
            id: tabId,
            label: tabId.charAt(0).toUpperCase() + tabId.slice(1),
            color: TAB_COLORS[newTabs.length % TAB_COLORS.length],
            visible: true,
            order: newTabs.length,
            rules: [],
          });
        }
      }

      // Keep user-created tabs that have no threads yet
      for (const leftover of existingById.values()) {
        newTabs.push(leftover);
      }

      // Re-number order
      newTabs.forEach((t, i) => { t.order = i; });

      setCategoryTabsState(newTabs);
      try { localStorage.setItem("dirac-category-tabs", JSON.stringify(newTabs)); } catch {}
    } catch {} finally {
      setCategoryLoading(false);
    }
  }, [gmailThreads, outlookThreads, session?.user?.email, preclassify, categoryTabs, categoryTabMap]);

  // ─── Topic tagging (AI-generated) ──────────────────────
  const runTopicTagging = useCallback(async () => {
    const allThreads = [...gmailThreads, ...outlookThreads];
    if (allThreads.length === 0) return;
    setTopicLoading(true);
    try {
      const summaries = allThreads.slice(0, 25).map((t) => ({
        threadId: t.id,
        subject: t.subject,
        snippet: t.snippet,
        from: t.participants[0]?.email ?? "",
      }));
      const res = await fetch("/api/ai/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threads: summaries }),
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, TopicTag[]> = {};
        for (const r of data.results ?? []) {
          if (r.threadId && r.topics?.length) map[r.threadId] = r.topics;
        }
        setTopicMap(map);
        try { localStorage.setItem(TOPICS_KEY, JSON.stringify(map)); } catch {}
      }
    } catch {} finally {
      setTopicLoading(false);
    }
  }, [gmailThreads, outlookThreads]);

  // ─── Pattern detection (Direction B.3) ──────────────────
  const dismissPattern = useCallback((id: string) => {
    setPatternSuggestions((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, dismissed: true } : p));
      try { localStorage.setItem(PATTERNS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const applyPattern = useCallback(
    (id: string) => {
      const pattern = patternSuggestions.find((p) => p.id === id);
      if (!pattern) return;
      const matchingThreads = [...gmailThreads, ...outlookThreads].filter((t) =>
        t.participants.some((p) => p.email === pattern.senderEmail),
      );
      for (const t of matchingThreads) {
        switch (pattern.suggestedAction) {
          case "archive": archiveThread(t.id); break;
          case "star": toggleStarred(t.id); break;
          case "mark_read": markThreadRead(t.id); break;
          case "mark_urgent": toggleUrgent(t.id); break;
        }
      }
      dismissPattern(id);
    },
    [patternSuggestions, gmailThreads, outlookThreads, archiveThread, toggleStarred, markThreadRead, toggleUrgent, dismissPattern],
  );

  // ─── Send reply (shared across brief + sidebar) ─────────
  // Resolves platform + recipient from threads state, calls the right endpoint.
  const sendThreadReply = useCallback(
    async (threadId: string, body: string): Promise<{ ok: boolean; error?: string }> => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return { ok: false, error: "Thread not found" };

      const userEmail = session?.user?.email?.toLowerCase();
      const recipient =
        thread.participants.find(
          (p) => p.email && (!userEmail || p.email.toLowerCase() !== userEmail),
        ) ?? thread.participants[0];

      if (!recipient?.email) return { ok: false, error: "No recipient found" };

      try {
        if (thread.platform === "DISCORD") {
          const channelId = threadId.replace(/^discord-/, "");
          const res = await fetch("/api/discord/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, content: body }),
          });
          if (!res.ok) throw new Error("Discord send failed");
        } else if (thread.platform === "OUTLOOK") {
          const res = await fetch("/api/outlook/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: recipient.email,
              subject: thread.subject,
              body,
            }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Send failed (${res.status})`);
          }
        } else {
          const res = await fetch("/api/gmail/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              to: recipient.email,
              subject: thread.subject,
              body,
            }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Send failed (${res.status})`);
          }
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Send failed",
        };
      }
    },
    [threads, session?.user?.email],
  );

  // ─── Relationship context (Direction B.4) ───────────────
  const getRelationshipContext = useCallback(
    (email: string): RelationshipContext | null => {
      const allThreads = [...gmailThreads, ...outlookThreads];
      const matching = allThreads.filter((t) =>
        t.participants.some((p) => p.email === email),
      );
      if (matching.length === 0) return null;
      const participant = matching[0].participants.find((p) => p.email === email);
      return {
        email,
        name: participant?.name ?? email,
        totalThreads: matching.length,
        avgResponseTimeHours: null,
        theirAvgResponseTimeHours: null,
        toneUsed: null,
        recentSubjects: matching.slice(0, 3).map((t) => t.subject),
        lastContacted: matching[0]?.lastMessageAt ?? null,
      };
    },
    [gmailThreads, outlookThreads],
  );

  // ─── Check connector statuses ─────────────────────────
  useEffect(() => {
    async function checkConnectors() {
      const [outlookRes, discordRes] = await Promise.allSettled([
        fetch("/api/outlook/status").then((r) => r.json()),
        fetch("/api/discord/status").then((r) => r.json()),
      ]);
      if (outlookRes.status === "fulfilled") {
        setOutlookConnected(outlookRes.value.connected ?? false);
      }
      if (discordRes.status === "fulfilled") {
        setDiscordConnected(discordRes.value.connected ?? false);
      }
    }
    checkConnectors();
  }, []);

  // ─── Fetch threads from all connected platforms ───────
  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);

    const promises: Promise<void>[] = [];

    if (session?.gmailConnected && !session?.error) {
      promises.push(
        fetch("/api/gmail/threads")
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              throw new Error(`Gmail fetch failed (${res.status}): ${body}`);
            }
            return res.json();
          })
          .then((data) => {
            const threads: DiracThread[] = data.threads ?? [];
            setGmailThreads(threads);
            setGmailNextPageToken(data.nextPageToken ?? undefined);

            // Passively accumulate sender history in localStorage (zero extra API calls)
            mergeSenderStatsFromThreads(threads);

            // Seed starred from Gmail's STARRED label (merge, don't overwrite)
            const gmailStarred = threads
              .filter((t) => t.isStarred)
              .map((t) => t.id);
            if (gmailStarred.length > 0) {
              setStarredIds((prev) => {
                const next = new Set(prev);
                let changed = false;
                for (const id of gmailStarred) {
                  if (!next.has(id)) {
                    next.add(id);
                    changed = true;
                  }
                }
                if (changed) saveStarred(next);
                return changed ? next : prev;
              });
            }
          })
          .catch((err) => {
            console.error("Gmail threads error:", err);
            setGmailThreads([]);
          }),
      );
    } else {
      setGmailThreads([]);
    }

    if (outlookConnected) {
      promises.push(
        fetch("/api/outlook/threads")
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              throw new Error(`Outlook fetch failed (${res.status}): ${body}`);
            }
            return res.json();
          })
          .then((data) => setOutlookThreads(data.threads ?? []))
          .catch((err) => {
            console.error("Outlook threads error:", err);
            setOutlookThreads([]);
          }),
      );
    } else {
      setOutlookThreads([]);
    }

    if (discordConnected) {
      promises.push(
        fetch("/api/discord/threads")
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              throw new Error(`Discord fetch failed (${res.status}): ${body}`);
            }
            return res.json();
          })
          .then((data) => setDiscordThreads(data.threads ?? []))
          .catch((err) => {
            console.error("Discord threads error:", err);
            setDiscordThreads([]);
          }),
      );
    } else {
      setDiscordThreads([]);
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    setThreadsLoading(false);
  }, [session?.gmailConnected, outlookConnected, discordConnected]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const loadMoreThreads = useCallback(async () => {
    if (!session?.gmailConnected || !gmailNextPageToken || loadingMoreThreads) return;
    setLoadingMoreThreads(true);
    try {
      const res = await fetch(`/api/gmail/threads?pageToken=${encodeURIComponent(gmailNextPageToken)}&maxResults=25`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newThreads: DiracThread[] = data.threads ?? [];
      mergeSenderStatsFromThreads(newThreads);
      setGmailThreads(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const deduped = newThreads.filter(t => !existingIds.has(t.id));
        return [...prev, ...deduped];
      });
      setGmailNextPageToken(data.nextPageToken ?? undefined);
    } catch (err) {
      console.error("Load more threads error:", err);
    } finally {
      setLoadingMoreThreads(false);
    }
  }, [session?.gmailConnected, gmailNextPageToken, loadingMoreThreads]);

  // ─── Triage classification ─────────────────────────────
  const runTriageForThreads = useCallback(
    async (allThreads: DiracThread[]) => {
      if (allThreads.length === 0) return;
      setTriageLoading(true);
      try {
        const userEmail = session?.user?.email ?? "";
        const summaries = allThreads.slice(0, 20).map((t) => ({
          threadId: t.id,
          subject: t.subject,
          snippet: t.snippet,
          lastSenderIsMe: t.participants[0]?.email === userEmail,
          isUnread: t.isUnread,
        }));

        const res = await fetch("/api/ai/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threads: summaries }),
        });

        if (res.ok) {
          const data = await res.json();
          const map: Record<string, TriageCategory> = {};
          for (const r of data.results ?? []) {
            if (r.threadId && r.category) {
              map[r.threadId] = r.category;
            }
          }
          setTriageMap(map);
        }
      } catch {
        // Non-critical
      } finally {
        setTriageLoading(false);
      }
    },
    [session?.user?.email],
  );

  const runTriage = useCallback(() => {
    const allThreads = [...gmailThreads, ...outlookThreads];
    runTriageForThreads(allThreads);
  }, [gmailThreads, outlookThreads, runTriageForThreads]);

  // ─── Run urgency detection + triage after threads load ─
  useEffect(() => {
    const allThreads = [...gmailThreads, ...outlookThreads];
    if (allThreads.length === 0) return;

    async function detectUrgency() {
      try {
        const res = await fetch("/api/ai/urgency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threads: allThreads.map((t) => ({
              id: t.id,
              subject: t.subject,
              snippet: t.snippet,
              lastMessageAt: t.lastMessageAt,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setUrgentIds(new Set(data.urgentIds ?? []));
        }
      } catch {
        // Silently fail — urgency is non-critical
      }
    }

    detectUrgency();

    // Also run triage classification
    runTriageForThreads(allThreads);

    // Run founder-category classification (Direction B.1)
    runCategorization();

    // Run topic tagging
    runTopicTagging();
  }, [gmailThreads, outlookThreads]);

  // Re-apply sender overrides on top of the existing categoryMap when rules
  // change. This keeps already-classified threads in sync without needing to
  // burn a full AI run — instant feedback when the user adds/removes a rule.
  useEffect(() => {
    if (senderOverrides.length === 0 && Object.keys(categoryMap).length === 0) return;
    setCategoryMap((prev) => {
      let changed = false;
      const next: Record<string, FounderCategory> = { ...prev };
      for (const t of threads) {
        const addr = t.participants[0]?.email ?? "";
        const forced = matchSenderOverride(addr, senderOverrides);
        if (forced && next[t.id] !== forced) {
          next[t.id] = forced;
          changed = true;
        }
      }
      if (!changed) return prev;
      try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // categoryMap is intentionally omitted from deps — we read the latest via
    // the functional updater and don't want to re-run when we ourselves write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderOverrides, threads]);

  // ─── Fetch messages when thread is selected ───────────
  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    // Guard: only fetch if the thread actually exists locally
    const allLocalThreads = [...gmailThreads, ...outlookThreads, ...discordThreads];
    const localThread = allLocalThreads.find((t) => t.id === selectedThreadId);
    if (!localThread) {
      setMessages([]);
      return;
    }

    // Prefer thread.platform over ID-prefix checks when the thread object is available
    const isDiscordThread = localThread.platform === "DISCORD";
    const isOutlookThread = localThread.platform === "OUTLOOK";
    const isGmail = localThread.platform === "GMAIL";

    if (isGmail && !session?.gmailConnected) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const apiUrl = isDiscordThread
          ? `/api/discord/threads/${selectedThreadId}`
          : isOutlookThread
            ? `/api/outlook/threads/${selectedThreadId}`
            : `/api/gmail/threads/${selectedThreadId}`;

        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        if (!cancelled) {
          setMessages(data.messages ?? []);

          if (isGmail) {
            setGmailThreads((prev) =>
              prev.map((t) =>
                t.id === selectedThreadId ? { ...t, isUnread: false } : t,
              ),
            );
          } else if (isOutlookThread) {
            setOutlookThreads((prev) =>
              prev.map((t) =>
                t.id === selectedThreadId ? { ...t, isUnread: false } : t,
              ),
            );
          }
        }
      } catch (err) {
        console.error("Message fetch error:", err);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, session?.gmailConnected]);

  // ─── Context value ────────────────────────────────────
  // Derive undo state for display
  const currentUndoAction = currentUndo?.action ?? null;
  const currentUndoTimeLeft = currentUndo?.timeLeft ?? 0;
  
  const value = useMemo<AppState>(
    () => ({
      selectedThreadId,
      setSelectedThreadId,
      aiSidebarOpen,
      setAiSidebarOpen,
      inboxFilter,
      setInboxFilter,
      threads,
      threadsLoading,
      loadMoreThreads,
      loadingMoreThreads,
      hasMoreThreads: !!gmailNextPageToken,
      messages,
      messagesLoading,
      refreshThreads: fetchThreads,
      composeOpen,
      setComposeOpen,
      composeMinimized,
      setComposeMinimized,
      toneProfile,
      setToneProfile,
      toggleStarred,
      toggleUrgent,
      markThreadUnread,
      markThreadRead,
      archiveThread,
      unarchiveThread,
      trashThread,
      untrashThread,
      aiContext,
      addToAiContext,
      removeFromAiContext,
      toggleAiContext,
      clearAiContext,      isInAiContext,
      triageMap,
      triageLoading,
      runTriage,
      pendingAiQuery,
      setPendingAiQuery,
      searchQuery,
      setSearchQuery,
      density,
      setDensity,
      selectedThreadIds,
      toggleBulkSelect,
      selectAll,
      clearSelection,
      unreadCount: threads.filter(t => t.isUnread).length,
      snoozedThreads,
      snoozeThread,
      unsnoozeThread,
      doneThreads: doneThreadIds,
      markDone,
      unmarkDone,
      commitments,
      setCommitments,
      dismissCommitment,
      categoryMap,
      setCategoryMap,
      categoryLoading,
      runCategorization,
      categoryTabMap,
      categoryTabs,
      setCategoryTabs,
      activeTab,
      setActiveTab,
      patternSuggestions: patternSuggestions.filter((p) => !p.dismissed),
      dismissPattern,
      applyPattern,
      getRelationshipContext,
      topicMap,
      topicLoading,
      runTopicTagging,
      setAsideThreadIds,
      addToSetAside,
      removeFromSetAside,
      clearSetAside,
      viewAllThreadIds,
      viewAllOpen,
      openViewAll,
      closeViewAll,
      clips,
      addClip,
      removeClip,
      // Undo system
      undoStack,
      currentUndo,
      pushUndoAction: pushUndoAction,
      performUndo: performUndo,
      dismissUndo: dismissUndo,
      sendThreadReply,
    }),
    [
      selectedThreadId,
      aiSidebarOpen,
      inboxFilter,
      threads,
      threadsLoading,
      loadMoreThreads,
      loadingMoreThreads,
      gmailNextPageToken,
      messages,
      messagesLoading,
      fetchThreads,
      composeOpen,
      composeMinimized,
      toneProfile,
      setToneProfile,
      toggleStarred,
      toggleUrgent,
      markThreadUnread,
      markThreadRead,
      archiveThread,
      unarchiveThread,
      trashThread,
      untrashThread,
      aiContext,
      addToAiContext,
      removeFromAiContext,
      toggleAiContext,
      clearAiContext,      isInAiContext,
      triageMap,
      triageLoading,
      runTriage,
      pendingAiQuery,
      searchQuery,
      density,
      selectedThreadIds,
      snoozedThreads,
      snoozeThread,
      unsnoozeThread,
      doneThreadIds,
      markDone,
      unmarkDone,
      commitments,
      setCommitments,
      dismissCommitment,
      categoryMap,
      setCategoryMap,
      categoryLoading,
      runCategorization,
      categoryTabMap,
      categoryTabs,
      setCategoryTabs,
      activeTab,
      setActiveTab,
      patternSuggestions,
      dismissPattern,
      applyPattern,
      getRelationshipContext,
      topicMap,
      topicLoading,
      runTopicTagging,
      setAsideThreadIds,
      addToSetAside,
      removeFromSetAside,
      clearSetAside,
      viewAllThreadIds,
      viewAllOpen,
      openViewAll,
      closeViewAll,
      clips,
      addClip,
      removeClip,
      currentUndo,
      currentUndoAction,
      currentUndoTimeLeft,
      sendThreadReply,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
