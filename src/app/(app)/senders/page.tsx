"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  ShieldOff, Mail, Search, X, ChevronDown,
  ArrowUpDown, RefreshCw,
} from "lucide-react";
import {
  loadSenderStatsMap,
  mergeSenderStatsFromThreads,
  isSenderBackfillDone,
  markSenderBackfillDone,
  getSenderStatsUpdatedAt,
  type SenderStatsMap,
} from "@/lib/sender-stats";
import { loadSenderAiCategories } from "@/lib/sender-categories";
import { classifyUnknownSenders, preclassifyEmail } from "@/lib/sender-classify";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { useSession } from "next-auth/react";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  type FounderCategory,
} from "@/lib/types";
import {
  loadSenderOverrides,
  addSenderOverride,
  SENDER_OVERRIDES_CHANGED_EVENT,
} from "@/lib/sender-overrides";
import { loadScreenedSenders, SCREENER_CHANGED_EVENT } from "@/lib/screener";

// ── Types ────────────────────────────────────────────────────────────────────

interface SenderInfo {
  email: string;
  name: string;
  domain: string;
  threadCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  category: FounderCategory | "unknown";
}

type SortKey = "name" | "category" | "status" | "firstSeen" | "lastSeen";
type SortDir = "asc" | "desc";

const ALL_CATS: FounderCategory[] = [
  "team", "investor", "customer", "vendor", "recruiter",
  "pr_media", "outreach", "personal", "automated",
];

// ── Category badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: FounderCategory | "unknown" }) {
  if (category === "unknown") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted/50 text-muted-foreground">
        Uncategorized
      </span>
    );
  }
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
      FOUNDER_CATEGORY_COLORS[category],
    )}>
      {FOUNDER_CATEGORY_LABELS[category]}
    </span>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ screened }: { screened: boolean }) {
  if (screened) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Screened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

// ── Category dropdown ─────────────────────────────────────────────────────────

function CategoryDropdown({
  current,
  onChange,
}: {
  current: FounderCategory | "unknown";
  onChange: (cat: FounderCategory) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <CategoryBadge category={current} />
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            {ALL_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => { onChange(cat); setOpen(false); }}
                className={cn(
                  "flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-muted/50 transition-colors",
                  current === cat && "bg-muted/30",
                )}
              >
                {FOUNDER_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sender row ────────────────────────────────────────────────────────────────

function SenderRow({
  sender,
  isScreened,
  onCategoryChange,
}: {
  sender: SenderInfo;
  isScreened: boolean;
  onCategoryChange: (email: string, cat: FounderCategory) => void;
}) {
  const initials = sender.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || sender.email[0]?.toUpperCase() || "?";

  const firstSeen = (() => {
    try { return formatDistanceToNow(new Date(sender.firstSeenAt), { addSuffix: true }); }
    catch { return "—"; }
  })();

  const lastSeen = (() => {
    try { return formatDistanceToNow(new Date(sender.lastSeenAt), { addSuffix: true }); }
    catch { return "—"; }
  })();

  return (
    <tr className="group border-b border-border/30 hover:bg-muted/15 transition-colors">
      {/* Name + email */}
      <td className="py-3 pl-8 pr-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[11px] font-semibold text-muted-foreground/70 select-none border border-border/40">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground leading-snug">
              {sender.name !== sender.email ? sender.name : sender.email}
            </p>
            <p className="truncate text-[11px] text-muted-foreground/45">
              {sender.name !== sender.email ? sender.email : sender.domain}
            </p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-3 px-4">
        <CategoryDropdown
          current={sender.category}
          onChange={(cat) => onCategoryChange(sender.email, cat)}
        />
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <StatusBadge screened={isScreened} />
      </td>

      {/* First seen */}
      <td className="py-3 px-4 text-[12px] text-muted-foreground/50 whitespace-nowrap tabular-nums">
        {firstSeen}
      </td>

      {/* Last seen */}
      <td className="py-3 pl-4 pr-8 text-[12px] text-muted-foreground/50 whitespace-nowrap tabular-nums">
        {lastSeen}
      </td>
    </tr>
  );
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={cn(
        "py-2.5 px-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground/50 cursor-pointer select-none whitespace-nowrap hover:text-muted-foreground transition-colors",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "text-primary" : "opacity-0 group-hover:opacity-100")} />
      </span>
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type BackfillStatus = "idle" | "running" | "done";

// How many extra pages to fetch during the one-time historical backfill.
// 8 pages × 50 threads = up to 400 historical threads.
const BACKFILL_PAGES = 8;

const PUBLIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "aol.com", "zoho.com",
]);

export default function SendersPage() {
  const { threads } = useAppState();
  const { data: session } = useSession();
  const teamDomain = useMemo(() => {
    const raw = session?.user?.email?.split("@")[1]?.toLowerCase() ?? "";
    return PUBLIC_DOMAINS.has(raw) ? "" : raw;
  }, [session?.user?.email]);

  const [overrides, setOverrides] = useState(loadSenderOverrides());
  const [screenedMap, setScreenedMap] = useState<Map<string, string>>(
    () => new Map(loadScreenedSenders().map((s) => [s.email, s.screenedAt])),
  );
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "screened">("all");
  const [filterCat, setFilterCat] = useState<FounderCategory | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastSeen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [statusDropOpen, setStatusDropOpen] = useState(false);

  // ── localStorage-backed sender history cache ─────────────────────────────
  const [statsCache, setStatsCache] = useState<SenderStatsMap>(() => loadSenderStatsMap());
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus>("idle");
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(() => getSenderStatsUpdatedAt());
  const backfillStartedRef = useRef(false);

  // ── Sender AI categories (shared with inbox — updated by runCategorization) ─
  const [senderAiCats, setSenderAiCats] = useState<Record<string, import("@/lib/types").FounderCategory>>(
    () => loadSenderAiCategories(),
  );

  // Re-read AI categories whenever app-provider writes new data
  useEffect(() => {
    const onStorage = () => setSenderAiCats(loadSenderAiCategories());
    window.addEventListener("storage", onStorage);
    const interval = setInterval(() => setSenderAiCats(loadSenderAiCategories()), 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setOverrides(loadSenderOverrides());
    window.addEventListener(SENDER_OVERRIDES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SENDER_OVERRIDES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const refresh = () =>
      setScreenedMap(new Map(loadScreenedSenders().map((s) => [s.email, s.screenedAt])));
    window.addEventListener(SCREENER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SCREENER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // ── One-time historical backfill ─────────────────────────────────────────
  // On first ever visit to /senders, paginate through BACKFILL_PAGES of inbox
  // history in the background, merging results into localStorage.
  // No server storage — all data stays on the client.
  useEffect(() => {
    if (backfillStartedRef.current || isSenderBackfillDone()) return;
    backfillStartedRef.current = true;
    setBackfillStatus("running");

    (async () => {
      try {
        let pageToken: string | undefined;
        for (let page = 0; page < BACKFILL_PAGES; page++) {
          const url = pageToken
            ? `/api/gmail/threads?maxResults=50&pageToken=${encodeURIComponent(pageToken)}`
            : "/api/gmail/threads?maxResults=50";

          const res = await fetch(url);
          if (!res.ok) break;
          const data = await res.json();
          const batch = data.threads ?? [];

          if (batch.length > 0) {
            mergeSenderStatsFromThreads(batch);
            // Refresh the local state so the table updates as data arrives
            setStatsCache(loadSenderStatsMap());
            setCacheUpdatedAt(getSenderStatsUpdatedAt());
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;
        }
        markSenderBackfillDone();
      } finally {
        setBackfillStatus("done");
        setStatsCache(loadSenderStatsMap());
        setCacheUpdatedAt(getSenderStatsUpdatedAt());
      }
    })();
  }, []);

  // Build sender list.
  // Category priority: manual override > AI sender cache > unknown.
  // Date priority: localStorage history cache (accurate over time) merged with in-memory threads.
  const senders = useMemo<SenderInfo[]>(() => {
    const map = new Map<string, SenderInfo>();

    const resolveCategory = (addr: string): FounderCategory | "unknown" => {
      const overrideCat = overrides.find((r) => {
        if (r.pattern.includes("@")) return r.pattern === addr;
        const domain = addr.split("@")[1] ?? "";
        return domain === r.pattern || domain.endsWith(`.${r.pattern}`);
      });
      return overrideCat?.category ?? senderAiCats[addr] ?? "unknown";
    };

    // Seed from localStorage history cache (accurate historical dates)
    for (const [addr, cached] of Object.entries(statsCache)) {
      map.set(addr, {
        email: addr,
        name: cached.name || addr,
        domain: addr.split("@")[1] ?? "",
        threadCount: 0,
        firstSeenAt: cached.firstSeenAt,
        lastSeenAt: cached.lastSeenAt,
        category: resolveCategory(addr),
      });
    }

    // Overlay in-memory threads (most recent activity + fills gaps)
    for (const thread of threads) {
      const threadFirstDate = thread.firstMessageAt ?? thread.lastMessageAt;
      for (const p of thread.participants) {
        if (!p.email) continue;
        const addr = p.email.toLowerCase();
        const existing = map.get(addr);
        if (existing) {
          existing.threadCount++;
          if (threadFirstDate < existing.firstSeenAt) existing.firstSeenAt = threadFirstDate;
          if (thread.lastMessageAt > existing.lastSeenAt) existing.lastSeenAt = thread.lastMessageAt;
          // Re-resolve category in case AI cats updated since seed
          existing.category = resolveCategory(addr);
        } else {
          map.set(addr, {
            email: addr,
            name: p.name || addr,
            domain: addr.split("@")[1] ?? "",
            threadCount: 1,
            firstSeenAt: threadFirstDate,
            lastSeenAt: thread.lastMessageAt,
            category: resolveCategory(addr),
          });
        }
      }
    }

    return Array.from(map.values());
  }, [threads, overrides, statsCache, senderAiCats]);

  // ── Auto-classify uncategorized senders ──────────────────────────────────
  // Each email is attempted exactly once per page session. Storing attempted
  // emails in a ref prevents the "classify → partial update → re-render →
  // classify again" loop that causes 429 spam.
  const attemptedEmailsRef = useRef(new Set<string>());
  useEffect(() => {
    const uncategorized = senders.filter(
      (s) => s.category === "unknown" && !attemptedEmailsRef.current.has(s.email),
    );
    if (uncategorized.length === 0) return;

    // Mark all as attempted BEFORE the async call so re-renders don't re-queue them
    for (const s of uncategorized) attemptedEmailsRef.current.add(s.email);

    classifyUnknownSenders(
      uncategorized.map((s) => ({ email: s.email, name: s.name })),
      teamDomain || undefined,
      (newCats) => setSenderAiCats({ ...newCats }),
    ).then(() => {
      setSenderAiCats(loadSenderAiCategories());
    });
  }, [senders, teamDomain]);

  const handleCategoryChange = useCallback((email: string, cat: FounderCategory) => {
    addSenderOverride(email, cat);
    setOverrides(loadSenderOverrides());
  }, []);

  // Filter
  const filtered = useMemo(() => {
    let list = senders;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.email.includes(q) || s.name.toLowerCase().includes(q) || s.domain.includes(q),
      );
    }
    if (filterStatus === "active") list = list.filter((s) => !screenedMap.has(s.email));
    if (filterStatus === "screened") list = list.filter((s) => screenedMap.has(s.email));
    if (filterCat !== "all") list = list.filter((s) => s.category === filterCat);
    return list;
  }, [senders, search, filterStatus, filterCat, screenedMap]);

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "category": return dir * a.category.localeCompare(b.category);
        case "status": {
          const as = screenedMap.has(a.email) ? 1 : 0;
          const bs = screenedMap.has(b.email) ? 1 : 0;
          return dir * (as - bs);
        }
        case "firstSeen": return dir * (a.firstSeenAt.localeCompare(b.firstSeenAt));
        case "lastSeen":
        default: return dir * (a.lastSeenAt.localeCompare(b.lastSeenAt));
      }
    });
  }, [filtered, sortKey, sortDir, screenedMap]);

  const handleSort = useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir("desc");
      return k;
    });
  }, []);

  const totalSenders = senders.length;
  const totalScreened = useMemo(
    () => senders.filter((s) => screenedMap.has(s.email)).length,
    [senders, screenedMap],
  );
  const totalActive = totalSenders - totalScreened;

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="border-b border-border px-8 pt-6 pb-5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 data-tour="senders" className="text-xl font-semibold text-foreground tracking-tight">
              Senders
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground/55">
              Everyone who has emailed you. Click a category to reassign.
            </p>
          </div>
          <Link
            href="/senders/screener"
            data-tour="screener"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[12px] font-medium text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <ShieldOff className="h-3.5 w-3.5 text-rose-400" />
            Screener
          </Link>
        </div>

        {/* Inline stats */}
        <div className="mt-4 flex items-center gap-6">
          {[
            { label: "All senders", value: totalSenders },
            { label: "Active", value: totalActive },
            { label: "Screened", value: totalScreened },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
              <span className="text-[12px] text-muted-foreground/50">{label}</span>
            </div>
          ))}
          {backfillStatus === "running" && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/40">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Building history…
            </span>
          )}
        </div>
      </div>

      {/* ── Filters bar ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border px-8 py-3 shrink-0">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/25 px-3 py-1.5 w-72">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or domain…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/35 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => setStatusDropOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            {filterStatus === "all" ? "All statuses" : filterStatus === "active" ? "Active" : "Screened"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {statusDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1">
                {(["all", "active", "screened"] as const).map((s) => (
                  <button key={s} onClick={() => { setFilterStatus(s); setStatusDropOpen(false); }}
                    className={cn("flex w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted/50 transition-colors capitalize", filterStatus === s && "bg-muted/30 font-medium")}>
                    {s === "all" ? "All statuses" : s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <button
            onClick={() => setCatDropOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            {filterCat === "all" ? "All categories" : FOUNDER_CATEGORY_LABELS[filterCat]}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {catDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCatDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1">
                <button onClick={() => { setFilterCat("all"); setCatDropOpen(false); }}
                  className={cn("flex w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted/50 transition-colors", filterCat === "all" && "bg-muted/30 font-medium")}>
                  All categories
                </button>
                {ALL_CATS.map((cat) => (
                  <button key={cat} onClick={() => { setFilterCat(cat); setCatDropOpen(false); }}
                    className={cn("flex w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted/50 transition-colors", filterCat === cat && "bg-muted/30 font-medium")}>
                    {FOUNDER_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground/40 tabular-nums">
          {sorted.length} sender{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/20" />
            {senders.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">No senders yet</p>
                <p className="text-xs text-muted-foreground/50">
                  Senders appear once your inbox has loaded threads.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No senders match your filters</p>
                <button
                  onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCat("all"); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/40 border-b border-border/60">
                <SortTh label="Email" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} className="pl-8" />
                <SortTh label="Category" sortKey="category" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="First seen" sortKey="firstSeen" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Last seen" sortKey="lastSeen" current={sortKey} dir={sortDir} onSort={handleSort} className="pr-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((sender) => (
                <SenderRow
                  key={sender.email}
                  sender={sender}
                  isScreened={screenedMap.has(sender.email)}
                  onCategoryChange={handleCategoryChange}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
