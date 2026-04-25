"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { AppContext, type AppState, type AiContextItem, type ToneProfile, type Clip } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
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
  const { data: session } = useSession();
  const { toast } = useToast();

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
  const toggleStarred = useCallback((threadId: string) => {
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
  }, []);

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
  const markThreadRead = useCallback((threadId: string) => {
    // Only the ID is available here; use prefix as platform hint
    const isOutlook = threadId.startsWith("outlook-");
    const isDiscord = threadId.startsWith("discord-");

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
  }, []);

  // ─── Archive thread (optimistic remove + API) ──────
  const archiveThread = useCallback(
    (threadId: string) => {
      // Only the ID is available here; use prefix as platform hint
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");

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
      toast({ title: "Thread archived", variant: "success" });
    },
    [selectedThreadId, toast],
  );

  // ─── Trash thread (optimistic remove + API) ────────
  const trashThread = useCallback(
    (threadId: string) => {
      // Only the ID is available here; use prefix as platform hint
      const isOutlook = threadId.startsWith("outlook-");
      const isDiscord = threadId.startsWith("discord-");

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
      toast({ title: "Thread moved to trash", variant: "default" });
    },
    [selectedThreadId, toast],
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
    (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">) => {
      setSnoozedThreads((prev) => {
        const next = [
          ...prev.filter((s) => s.threadId !== threadId),
          { ...snooze, threadId, snoozedAt: new Date().toISOString() },
        ];
        try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      if (selectedThreadId === threadId) setSelectedThreadId(null);
    },
    [selectedThreadId],
  );

  const unsnoozeThread = useCallback((threadId: string) => {
    setSnoozedThreads((prev) => {
      const next = prev.filter((s) => s.threadId !== threadId);
      try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
  const markDone = useCallback((threadId: string) => {
    setDoneThreadIds((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      try { localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

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
  const preclassify = useCallback((email: string, subject: string): FounderCategory | null => {
    const addr = email.toLowerCase();
    const subj = subject.toLowerCase();

    // User-configured rules beat every heuristic — they're an explicit override.
    const manual = matchSenderOverride(addr, senderOverrides);
    if (manual) return manual;

    // No-reply / machine senders
    const automatedAddressPatterns = [
      "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply", "do_not_reply",
      "notifications@", "notification@", "alerts@", "alert@",
      "newsletter@", "newsletters@", "digest@", "mailer@", "mailer-daemon",
      "bounce@", "-bounces@", "bounces@", "postmaster@",
      "support@github", "noreply@github", "noreply@gitlab",
      "noreply@vercel", "noreply@netlify", "noreply@heroku",
      "noreply@stripe", "noreply@paypal", "noreply@shopify",
      "sendgrid", "mailchimp", "mailgun", "mandrillapp", "postmarkapp",
      "amazonses", "amazonaws.com", "sparkpostmail",
      "updates@", "update@", "info@", "automated@",
    ];
    if (automatedAddressPatterns.some((p) => addr.includes(p))) return "automated";

    // Subject-line signals for newsletters / automated
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
    if (automatedSubjectPatterns.some((p) => subj.includes(p))) return "automated";

    return null; // defer to AI
  }, [senderOverrides]);

  const runCategorization = useCallback(async () => {
    const allThreads = [...gmailThreads, ...outlookThreads];
    if (allThreads.length === 0) return;
    setCategoryLoading(true);
    // Derive team domain from logged-in user's email (e.g. "acme.com")
    // Public email providers — never treat these as a "team domain"
    const PUBLIC_DOMAINS = new Set([
      "gmail.com", "googlemail.com",
      "outlook.com", "hotmail.com", "live.com", "msn.com",
      "yahoo.com", "yahoo.co.uk", "ymail.com",
      "icloud.com", "me.com", "mac.com",
      "proton.me", "protonmail.com",
      "aol.com", "zoho.com",
    ]);
    const rawDomain = session?.user?.email?.split("@")[1]?.toLowerCase() ?? "";
    const teamDomain = PUBLIC_DOMAINS.has(rawDomain) ? "" : rawDomain;
    try {
      const preMap: Record<string, FounderCategory> = {};
      const needsAi: typeof allThreads = [];

      for (const t of allThreads.slice(0, 40)) {
        const senderEmail = t.participants[0]?.email ?? "";
        const pre = preclassify(senderEmail, t.subject);
        if (pre) {
          preMap[t.id] = pre;
        } else {
          needsAi.push(t);
        }
      }

      const summaries = needsAi.slice(0, 30).map((t) => ({
        threadId: t.id,
        subject: t.subject,
        snippet: t.snippet ?? "",
        from: t.participants[0]?.email ?? "",
        fromName: t.participants[0]?.name ?? "",
        messageCount: t.messageCount,
        participantCount: t.participants.length,
        isForward: /^(fwd?|fw)\s*:/i.test(t.subject),
      }));

      const map: Record<string, FounderCategory> = { ...preMap };
      const tabMap: Record<string, string> = { ...categoryTabMap };

      // Pre-classify tabs by PURPOSE, not sender brand
      for (const t of allThreads.slice(0, 40)) {
        if (teamDomain && t.participants[0]?.email?.endsWith(`@${teamDomain}`)) {
          tabMap[t.id] = "team";
          continue;
        }
        if (preMap[t.id] === "automated") {
          const addr = (t.participants[0]?.email ?? "").toLowerCase();
          const subj = t.subject.toLowerCase();

          // CI/CD & build notifications
          if (["github", "gitlab", "bitbucket", "vercel", "netlify", "heroku", "railway", "render", "circleci", "jenkins"].some(s => addr.includes(s))
            || ["build", "deploy", "pipeline", "ci ", "ci/cd", "preview"].some(s => subj.includes(s))) {
            tabMap[t.id] = "builds & deploys";
          }
          // Billing & receipts
          else if (["stripe", "paypal", "mercury", "brex", "invoice", "receipt", "billing", "payment"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "receipts";
          }
          // Security & access
          else if (["security", "login", "verify", "password", "2fa", "authentication", "sign-in"].some(s => subj.includes(s))) {
            tabMap[t.id] = "security";
          }
          // Social media notifications
          else if (["instagram", "twitter", "facebook", "linkedin", "tiktok", "youtube", "threads", "mastodon"].some(s => addr.includes(s))) {
            tabMap[t.id] = "social";
          }
          // Newsletters & marketing
          else if (["newsletter", "digest", "weekly", "unsubscribe", "indiehackers", "morningbrew", "substack", "mailchimp", "beehiiv"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "newsletters";
          }
          // Monitoring & alerts
          else if (["sentry", "datadog", "pagerduty", "alert", "monitoring", "uptime", "incident"].some(s => addr.includes(s) || subj.includes(s))) {
            tabMap[t.id] = "alerts";
          }
          // Fallback for other automated
          else {
            tabMap[t.id] = "notifications";
          }
        }
      }

      if (summaries.length > 0) {
        const existingTabNames = categoryTabs.map(tab => tab.label.toLowerCase());
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threads: summaries, teamDomain, existingTabs: existingTabNames }),
        });
        if (res.ok) {
          const data = await res.json();
          for (const r of data.results ?? []) {
            if (r.threadId && r.category) map[r.threadId] = r.category;
            if (r.threadId && r.tab) {
              tabMap[r.threadId] = r.tab.toLowerCase().trim();
            }
          }
        }
      }

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

    if (session?.gmailConnected) {
      promises.push(
        fetch("/api/gmail/threads")
          .then((res) => {
            if (!res.ok) throw new Error("Gmail fetch failed");
            return res.json();
          })
          .then((data) => {
            const threads: DiracThread[] = data.threads ?? [];
            setGmailThreads(threads);

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
          .then((res) => {
            if (!res.ok) throw new Error("Outlook fetch failed");
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
          .then((res) => {
            if (!res.ok) throw new Error("Discord fetch failed");
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
      trashThread,
      aiContext,
      addToAiContext,
      removeFromAiContext,
      toggleAiContext,
      clearAiContext,
      isInAiContext,
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
    }),
    [
      selectedThreadId,
      aiSidebarOpen,
      inboxFilter,
      threads,
      threadsLoading,
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
      trashThread,
      aiContext,
      addToAiContext,
      removeFromAiContext,
      toggleAiContext,
      clearAiContext,
      isInAiContext,
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
