"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import {
  ArrowLeft, FileText, Mail, Trash2, Plus, ChevronUp, ChevronDown,
  Search, X, Loader2, Calendar,
} from "lucide-react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { AiSidebarSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DiracThread } from "@/lib/types";

const AiSidebar = dynamic(
  () => import("@/components/ai-sidebar/ai-sidebar").then((m) => m.AiSidebar),
  {
    ssr: false,
    loading: () => (
      <div className="hidden lg:flex h-full">
        <AiSidebarSkeleton />
      </div>
    ),
  }
);

// ── Gmail categories that belong in paper trail (non-primary) ────────────────
const PT_GMAIL_CATS = new Set(["CATEGORY_UPDATES", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"]);

// Maps a Dirac tab slug to the most accurate Gmail search query for "load more"
// Unknown tabs fall back to the thread's gmailCategory query.
const TAB_GMAIL_QUERY: Record<string, string> = {
  "receipts":         "category:promotions (receipt OR invoice OR order OR payment OR subscription)",
  "security":         "category:updates (security OR verify OR 2fa OR password OR suspicious OR alert)",
  "builds & deploys": "category:updates (build OR deploy OR pipeline OR github OR vercel OR netlify OR ci)",
  "alerts":           "category:updates (alert OR monitor OR down OR error OR incident OR sentry OR datadog)",
  "notifications":    "category:updates",
  "social":           "category:social",
  "newsletters":      "category:promotions",
  "product updates":  "category:updates (update OR changelog OR release OR new feature OR shipped)",
  "onboarding":       "category:updates (welcome OR getting started OR setup OR activate)",
  "marketing":        "category:promotions",
  "forums":           "category:forums",
  "team":             "category:updates",
};

// Fallback query when a tab has no explicit mapping
const gmailCatQuery = (cat: string | null | undefined) => {
  if (cat === "CATEGORY_PROMOTIONS") return "category:promotions";
  if (cat === "CATEGORY_SOCIAL")     return "category:social";
  if (cat === "CATEGORY_FORUMS")     return "category:forums";
  return "category:updates";
};

const SECTION_INITIAL = 12;
const SECTION_STEP    = 10;
const PAGE_SIZE       = 20;

const LS_EXCLUDED = "dirac-pt-excluded";
const LS_MANUAL   = "dirac-pt-manual";
const LS_ORDER    = "dirac-pt-order";

interface SectionState {
  pageToken?: string;
  loading: boolean;
  serverThreads: DiracThread[];
}

// ── Thread row ───────────────────────────────────────────────────────────────

function ThreadRow({
  thread, selectedThreadId, onSelect, onRemove, removable,
}: {
  thread: DiracThread;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  removable?: boolean;
}) {
  const sender  = thread.participants[0];
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false });
  return (
    <div className={cn(
      "group flex w-full items-start gap-3 border-b border-border px-5 py-3 transition-colors hover:bg-accent/20",
      thread.id === selectedThreadId && "bg-accent/50",
    )}>
      <button onClick={() => onSelect(thread.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">{thread.subject}</span>
            <span className="ml-auto shrink-0 tabular-nums text-xs text-muted-foreground/50">{timeAgo}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground/55">{sender?.name ?? sender?.email}</p>
          {thread.snippet && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/45">{thread.snippet}</p>
          )}
        </div>
      </button>
      {removable && onRemove && (
        <button onClick={() => onRemove(thread.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Per-section scrollable list ──────────────────────────────────────────────

function SectionThreadList({
  tabSlug, localThreads, sectionState, selectedThreadId, onSelect, onRemove, onLoadMore,
}: {
  tabSlug: string;
  localThreads: DiracThread[];
  sectionState: SectionState;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onLoadMore: (tabSlug: string) => void;
}) {
  const [visible, setVisible] = useState(SECTION_INITIAL);

  const allThreads = [
    ...localThreads,
    ...sectionState.serverThreads.filter(s => !localThreads.some(l => l.id === s.id)),
  ];

  useEffect(() => {
    setVisible(v => Math.max(v, Math.min(allThreads.length, SECTION_INITIAL)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allThreads.length]);

  const shown          = allThreads.slice(0, visible);
  const hasMoreLocal   = visible < allThreads.length;
  const hasMoreServer  = !!sectionState.pageToken;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (!nearBottom) return;
    if (hasMoreLocal) {
      setVisible(v => Math.min(allThreads.length, v + SECTION_STEP));
    } else if (hasMoreServer && !sectionState.loading) {
      onLoadMore(tabSlug);
    }
  }, [hasMoreLocal, hasMoreServer, sectionState.loading, allThreads.length, tabSlug, onLoadMore]);

  if (allThreads.length === 0 && !sectionState.loading) return (
    <p className="px-5 py-4 text-xs text-muted-foreground/35 italic">No emails in this category yet.</p>
  );

  return (
    <div onScroll={handleScroll} className="overflow-y-auto" style={{ maxHeight: 320 }}>
      {shown.map(t => (
        <ThreadRow key={t.id} thread={t} selectedThreadId={selectedThreadId}
          onSelect={onSelect} onRemove={onRemove} removable />
      ))}
      <div className="flex items-center justify-center border-b border-border/30 py-2.5">
        {sectionState.loading ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </span>
        ) : hasMoreLocal ? (
          <button onClick={() => setVisible(v => Math.min(allThreads.length, v + SECTION_STEP))}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors hover:underline underline-offset-2">
            {allThreads.length - visible} more ↓
          </button>
        ) : hasMoreServer ? (
          <button onClick={() => onLoadMore(tabSlug)}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors hover:underline underline-offset-2">
            Load older emails ↓
          </button>
        ) : (
          <span className="text-xs text-muted-foreground/25">All caught up</span>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PaperTrailPage() {
  const {
    threads, categoryMap, categoryTabMap, categoryTabs,
    setSelectedThreadId, selectedThreadId,
  } = useAppState();

  const [excluded,   setExcluded]   = useState<Set<string>>(new Set());
  const [manualIds,  setManualIds]  = useState<Set<string>>(new Set());
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [addQuery,   setAddQuery]   = useState("");
  const [addOpen,    setAddOpen]    = useState(false);

  // Per-section server pagination keyed by tab slug
  const [sections, setSections] = useState<Record<string, SectionState>>({});

  // Search
  const [ptSearch,       setPtSearch]       = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [serverResults,  setServerResults]  = useState<DiracThread[]>([]);
  const [serverLoading,  setServerLoading]  = useState(false);
  const [serverNextPage, setServerNextPage] = useState<string | undefined>();
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [serverMode,     setServerMode]     = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const ex  = localStorage.getItem(LS_EXCLUDED);
      const mn  = localStorage.getItem(LS_MANUAL);
      const ord = localStorage.getItem(LS_ORDER);
      if (ex)  setExcluded(new Set(JSON.parse(ex)));
      if (mn)  setManualIds(new Set(JSON.parse(mn)));
      if (ord) setGroupOrder(JSON.parse(ord));
    } catch {}
  }, []);

  const saveExcluded   = (s: Set<string>) => { setExcluded(s);  localStorage.setItem(LS_EXCLUDED, JSON.stringify([...s])); };
  const saveManualIds  = (s: Set<string>) => { setManualIds(s); localStorage.setItem(LS_MANUAL,   JSON.stringify([...s])); };
  const saveGroupOrder = (a: string[])    => { setGroupOrder(a); localStorage.setItem(LS_ORDER,   JSON.stringify(a)); };

  const removeThread = (id: string) => {
    const nextE = new Set(excluded); nextE.add(id); saveExcluded(nextE);
    if (manualIds.has(id)) { const nextM = new Set(manualIds); nextM.delete(id); saveManualIds(nextM); }
  };
  const addThread = (id: string) => {
    if (excluded.has(id)) { const nextE = new Set(excluded); nextE.delete(id); saveExcluded(nextE); }
    const nextM = new Set(manualIds); nextM.add(id); saveManualIds(nextM);
    setAddOpen(false); setAddQuery("");
  };

  // ── Build groups ─────────────────────────────────────────────────────────
  // Paper trail = non-personal Gmail category, OR AI says "automated", OR manually added
  const ptThreads = threads.filter(t => {
    if (excluded.has(t.id)) return false;
    if (manualIds.has(t.id)) return true;
    const cat = categoryMap[t.id];
    return PT_GMAIL_CATS.has(t.gmailCategory ?? "") || cat === "automated";
  });

  // Group by Dirac tab slug; fall back to a Gmail-derived label if not yet classified
  const groupMap: Record<string, DiracThread[]> = {};
  const tabColorMap: Record<string, string> = {};

  // Build tab color lookup from categoryTabs
  categoryTabs.forEach(tab => { tabColorMap[tab.id] = tab.color; });

  ptThreads.forEach(t => {
    const diracTab = categoryTabMap[t.id];
    let key: string;
    if (diracTab) {
      key = diracTab;
    } else {
      // Fallback: derive a readable label from Gmail category
      key = t.gmailCategory === "CATEGORY_PROMOTIONS" ? "promotions"
          : t.gmailCategory === "CATEGORY_SOCIAL"     ? "social"
          : t.gmailCategory === "CATEGORY_FORUMS"     ? "forums"
          : "notifications";
    }
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(t);
  });

  // Build ordered list: saved order first, then by thread count desc
  const allKeys    = Object.keys(groupMap);
  const orderedKeys = [
    ...groupOrder.filter(k => allKeys.includes(k)),
    ...allKeys.filter(k => !groupOrder.includes(k)).sort((a, b) => (groupMap[b]?.length ?? 0) - (groupMap[a]?.length ?? 0)),
  ];

  // Ensure section state exists for each key
  useEffect(() => {
    setSections(prev => {
      const next = { ...prev };
      let changed = false;
      orderedKeys.forEach(k => {
        if (!next[k]) { next[k] = { pageToken: "FIRST", loading: false, serverThreads: [] }; changed = true; }
      });
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedKeys.join(",")]);

  const moveGroup = (key: string, dir: -1 | 1) => {
    const idx = orderedKeys.indexOf(key);
    const si  = idx + dir;
    if (si < 0 || si >= orderedKeys.length) return;
    const next = [...orderedKeys];
    [next[idx], next[si]] = [next[si], next[idx]];
    saveGroupOrder(next);
  };

  // ── Per-section load more ────────────────────────────────────────────────
  const loadMoreForTab = useCallback(async (tabSlug: string) => {
    setSections(prev => {
      if (prev[tabSlug]?.loading) return prev;
      return { ...prev, [tabSlug]: { ...(prev[tabSlug] ?? { serverThreads: [] }), loading: true } };
    });
    try {
      // Prefer specific tab query, fall back to the gmail category of threads in this section
      const sampleThread = groupMap[tabSlug]?.[0];
      const q = TAB_GMAIL_QUERY[tabSlug] ?? gmailCatQuery(sampleThread?.gmailCategory);
      const pageToken = sections[tabSlug]?.pageToken;
      const params = new URLSearchParams({ q, maxResults: String(PAGE_SIZE) });
      if (pageToken && pageToken !== "FIRST") params.set("pageToken", pageToken);
      const res  = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      const newThreads: DiracThread[] = data.threads ?? [];
      setSections(prev => ({
        ...prev,
        [tabSlug]: {
          loading: false,
          pageToken: data.nextPageToken ?? undefined,
          serverThreads: [
            ...(prev[tabSlug]?.serverThreads ?? []),
            ...newThreads.filter(t => !(prev[tabSlug]?.serverThreads ?? []).some(s => s.id === t.id)),
          ],
        },
      }));
    } catch {
      setSections(prev => ({ ...prev, [tabSlug]: { ...(prev[tabSlug] ?? { serverThreads: [] }), loading: false } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // ── Global search ────────────────────────────────────────────────────────
  const buildQuery = useCallback(() => {
    const parts: string[] = [];
    if (ptSearch.trim()) parts.push(ptSearch.trim());
    if (dateFrom) parts.push(`after:${dateFrom.replace(/-/g, "/")}`);
    if (dateTo)   parts.push(`before:${dateTo.replace(/-/g, "/")}`);
    return parts.join(" ");
  }, [ptSearch, dateFrom, dateTo]);

  const runSearch = useCallback(async () => {
    const q = buildQuery();
    if (!q) { setServerMode(false); return; }
    setServerMode(true); setServerLoading(true);
    setServerResults([]); setServerNextPage(undefined);
    try {
      const res  = await fetch(`/api/gmail/threads?${new URLSearchParams({ q, maxResults: String(PAGE_SIZE) })}`);
      const data = await res.json();
      setServerResults(data.threads ?? []);
      setServerNextPage(data.nextPageToken);
    } catch { /* noop */ } finally { setServerLoading(false); }
  }, [buildQuery]);

  const loadMoreSearch = useCallback(async () => {
    if (!serverNextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q: buildQuery(), maxResults: String(PAGE_SIZE), pageToken: serverNextPage });
      const res  = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      setServerResults(prev => {
        const ids = new Set(prev.map(t => t.id));
        return [...prev, ...(data.threads ?? []).filter((t: DiracThread) => !ids.has(t.id))];
      });
      setServerNextPage(data.nextPageToken);
    } catch { /* noop */ } finally { setLoadingMore(false); }
  }, [serverNextPage, loadingMore, buildQuery]);

  useEffect(() => { if (!buildQuery()) setServerMode(false); }, [buildQuery]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !serverNextPage) return;
    const obs = new IntersectionObserver(
      e => { if (e[0]?.isIntersecting) loadMoreSearch(); }, { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [serverNextPage, loadMoreSearch]);

  const addable = threads.filter(t => {
    if (ptThreads.some(p => p.id === t.id)) return false;
    if (!addQuery.trim()) return true;
    const q = addQuery.toLowerCase();
    return t.subject.toLowerCase().includes(q) ||
      t.participants.some(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  });

  // Nice label for a tab slug: prefer categoryTabs label, else title-case the slug
  const tabLabel = (key: string) => {
    const found = categoryTabs.find(t => t.id === key);
    if (found) return found.label;
    return key.replace(/\b\w/g, c => c.toUpperCase());
  };

  const tabColor = (key: string) =>
    tabColorMap[key] ?? "bg-zinc-500/10 text-zinc-400";

  const totalLocal = ptThreads.length;

  return (
    <>
      <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/inbox"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Inbox
            </Link>
            <div className="h-4 w-px bg-border" />
            <FileText className="h-4 w-4 text-primary/70" />
            <h1 className="text-xl font-bold text-foreground">Paper trail</h1>
            <span className="text-sm text-muted-foreground/50">
              {serverMode ? `${serverResults.length}+ results` : `${totalLocal} threads`}
            </span>
            <button
              onClick={() => setAddOpen(v => !v)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                addOpen ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}>
              <Plus className="h-3.5 w-3.5" /> Add email
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            Automated and non-primary emails, grouped by purpose.
          </p>

          {/* Search + date */}
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <input type="text" placeholder="Search subject, sender, or keyword…"
                  value={ptSearch} onChange={e => setPtSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runSearch()}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 outline-none" />
                {ptSearch && (
                  <button onClick={() => setPtSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <button onClick={() => setShowDateFilter(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors shrink-0",
                  (showDateFilter || dateFrom || dateTo) ? "border-primary/40 bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent/50",
                )}>
                <Calendar className="h-3.5 w-3.5" /> Date
              </button>
              <button onClick={runSearch} disabled={!(ptSearch.trim() || dateFrom || dateTo) || serverLoading}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0">
                {serverLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Search
              </button>
              {serverMode && (
                <button onClick={() => { setServerMode(false); setPtSearch(""); setDateFrom(""); setDateTo(""); }}
                  className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {showDateFilter && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">From</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50" />
                <span className="shrink-0">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="text-muted-foreground/50 hover:text-muted-foreground"><X className="h-3 w-3" /></button>
                )}
              </div>
            )}
          </div>

          {/* Add-email panel */}
          {addOpen && (
            <div className="mt-3 rounded-xl border border-border bg-background p-3 shadow-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 mb-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <input type="text" placeholder="Search inbox threads to add…" value={addQuery}
                  onChange={e => setAddQuery(e.target.value)} autoFocus
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 outline-none" />
                <button onClick={() => { setAddOpen(false); setAddQuery(""); }}
                  className="text-muted-foreground/40 hover:text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                {addable.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground/50">
                    {addQuery ? "No matching threads" : "All threads are already in the paper trail"}
                  </p>
                ) : addable.slice(0, 25).map(t => (
                  <button key={t.id} onClick={() => addThread(t.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/50 transition-colors">
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <span className="flex-1 truncate text-xs text-foreground">{t.subject}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/40">
                      {t.participants[0]?.name ?? t.participants[0]?.email}
                    </span>
                    <Plus className="h-3 w-3 shrink-0 text-primary/60" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {serverMode ? (
            <div className="flex flex-col">
              {serverLoading && serverResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching Gmail…
                </div>
              ) : serverResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
                  <Search className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No results found</p>
                </div>
              ) : (
                <>
                  {serverResults.map(t => (
                    <ThreadRow key={t.id} thread={t} selectedThreadId={selectedThreadId}
                      onSelect={setSelectedThreadId} />
                  ))}
                  <div ref={sentinelRef} className="flex items-center justify-center py-4">
                    {loadingMore
                      ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</span>
                      : serverNextPage
                        ? <button onClick={loadMoreSearch} className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2">Load more</button>
                        : <p className="text-xs text-muted-foreground/30">No more results</p>
                    }
                  </div>
                </>
              )}
            </div>
          ) : orderedKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No automated threads yet</p>
              <p className="text-xs text-muted-foreground/50">
                Receipts, notifications, and other automated emails will appear here once categorized.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {orderedKeys.map((key, ki) => {
                const group   = groupMap[key] ?? [];
                const section = sections[key] ?? { loading: false, serverThreads: [] };

                return (
                  <div key={key} className="border-b border-border/30">
                    {/* Sticky section header */}
                    <div className="flex items-center gap-2 border-b border-border/40 bg-muted/25 px-5 py-2 sticky top-0 z-10">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", tabColor(key))}>
                        {tabLabel(key)}
                      </span>
                      <span className="text-xs text-muted-foreground/50">{group.length + section.serverThreads.length}</span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <button onClick={() => moveGroup(key, -1)} disabled={ki === 0}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveGroup(key, 1)} disabled={ki === orderedKeys.length - 1}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <SectionThreadList
                      tabSlug={key}
                      localThreads={group}
                      sectionState={section}
                      selectedThreadId={selectedThreadId}
                      onSelect={setSelectedThreadId}
                      onRemove={removeThread}
                      onLoadMore={loadMoreForTab}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <AiSidebar />
    </>
  );
}
