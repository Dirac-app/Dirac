"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Users, ShieldOff, Mail, Search, X, ChevronDown,
  Download, MoreHorizontal, GripVertical, ArrowUpDown, RefreshCw,
} from "lucide-react";
import type { SenderStatRow } from "@/app/api/senders/stats/route";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
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
    <tr className="group border-b border-border/40 hover:bg-muted/20 transition-colors">
      {/* Name + email */}
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground select-none">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground leading-snug">
              {sender.name !== sender.email ? sender.name : sender.email}
            </p>
            <p className="truncate text-[11px] text-muted-foreground/55">
              {sender.name !== sender.email ? sender.email : sender.domain}
            </p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-3 px-3">
        <CategoryDropdown
          current={sender.category}
          onChange={(cat) => onCategoryChange(sender.email, cat)}
        />
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        <StatusBadge screened={isScreened} />
      </td>

      {/* First seen */}
      <td className="py-3 px-3 text-[12px] text-muted-foreground/60 whitespace-nowrap">
        {firstSeen}
      </td>

      {/* Last seen */}
      <td className="py-3 pl-3 pr-4 text-[12px] text-muted-foreground/60 whitespace-nowrap">
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

type SyncStatus = "idle" | "syncing" | "done" | "error";

export default function SendersPage() {
  const { threads, categoryMap } = useAppState();

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

  // ── Sender stats cache (Supabase-backed for accurate historical dates) ───
  const [statsCache, setStatsCache] = useState<Map<string, SenderStatRow>>(new Map());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncedOnceRef = useRef(false);

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

  // ── Load cached stats from Supabase, then trigger background sync ────────
  const triggerSync = useCallback(async (forceFullSync = false) => {
    setSyncStatus("syncing");
    try {
      const url = forceFullSync ? "/api/senders/sync?full=true" : "/api/senders/sync";
      await fetch(url, { method: "POST" });
      // After sync, reload the stats
      const res = await fetch("/api/senders/stats");
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, SenderStatRow>();
        for (const row of data.stats ?? []) map.set(row.email, row);
        setStatsCache(map);
        setLastSyncedAt(data.lastSyncedAt ?? null);
      }
      setSyncStatus("done");
    } catch {
      setSyncStatus("error");
    }
  }, []);

  useEffect(() => {
    if (syncedOnceRef.current) return;
    syncedOnceRef.current = true;

    // Load existing cache immediately for fast render
    fetch("/api/senders/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const map = new Map<string, SenderStatRow>();
        for (const row of data.stats ?? []) map.set(row.email, row);
        setStatsCache(map);
        setLastSyncedAt(data.lastSyncedAt ?? null);

        // Trigger incremental sync in background
        triggerSync(false);
      })
      .catch(() => {
        // No cache yet — do a full sync
        triggerSync(false);
      });
  }, [triggerSync]);

  // Build sender list.
  // In-memory threads give us the most-recent activity; the Supabase cache
  // gives us accurate historical first/last seen dates. We merge both sources,
  // always preferring the earliest firstSeenAt and latest lastSeenAt.
  const senders = useMemo<SenderInfo[]>(() => {
    const map = new Map<string, SenderInfo>();

    // Seed from Supabase cache first (accurate historical data)
    for (const [addr, cached] of statsCache) {
      const overrideCat = overrides.find((r) => {
        if (r.pattern.includes("@")) return r.pattern === addr;
        const domain = addr.split("@")[1] ?? "";
        return domain === r.pattern || domain.endsWith(`.${r.pattern}`);
      });
      map.set(addr, {
        email: addr,
        name: cached.name || addr,
        domain: addr.split("@")[1] ?? "",
        threadCount: cached.threadCount,
        firstSeenAt: cached.firstSeenAt,
        lastSeenAt: cached.lastSeenAt,
        category: overrideCat?.category ?? "unknown",
      });
    }

    // Overlay in-memory threads: they may have very recent threads not yet
    // synced, and they carry the AI category assignment.
    for (const thread of threads) {
      // Use firstMessageAt (accurate thread start) when available, fall back to lastMessageAt
      const threadFirstDate = thread.firstMessageAt ?? thread.lastMessageAt;

      for (const p of thread.participants) {
        if (!p.email) continue;
        const addr = p.email.toLowerCase();
        const overrideCat = overrides.find((r) => {
          if (r.pattern.includes("@")) return r.pattern === addr;
          const domain = addr.split("@")[1] ?? "";
          return domain === r.pattern || domain.endsWith(`.${r.pattern}`);
        });
        const aiCat = categoryMap[thread.id] as FounderCategory | undefined;

        const existing = map.get(addr);
        if (existing) {
          if (threadFirstDate < existing.firstSeenAt)
            existing.firstSeenAt = threadFirstDate;
          if (thread.lastMessageAt > existing.lastSeenAt)
            existing.lastSeenAt = thread.lastMessageAt;
          // Let in-memory AI category override unknown
          if (existing.category === "unknown" && (overrideCat?.category ?? aiCat)) {
            existing.category = overrideCat?.category ?? aiCat ?? "unknown";
          }
        } else {
          map.set(addr, {
            email: addr,
            name: p.name || addr,
            domain: addr.split("@")[1] ?? "",
            threadCount: 1,
            firstSeenAt: threadFirstDate,
            lastSeenAt: thread.lastMessageAt,
            category: overrideCat?.category ?? aiCat ?? "unknown",
          });
        }
      }
    }

    return Array.from(map.values());
  }, [threads, categoryMap, overrides, statsCache]);

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
      {/* Header */}
      <div className="border-b border-border px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1
            data-tour="senders"
            className="text-lg font-semibold text-foreground"
          >
            Senders
          </h1>

          <Link
            href="/senders/screener"
            data-tour="screener"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Screener
          </Link>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground/55">
          All senders from your inbox. Click a category badge to reassign.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-border shrink-0">
        {[
          { label: "All senders", value: totalSenders },
          { label: "Active", value: totalActive },
          { label: "Screened", value: totalScreened },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-4 border-r border-border/50 last:border-r-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/45">{label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 flex-1 max-w-64">
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
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            {filterStatus === "all" ? "All statuses" : filterStatus === "active" ? "Active" : "Screened"}
            <ChevronDown className="h-3 w-3" />
          </button>
          {statusDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                {(["all", "active", "screened"] as const).map((s) => (
                  <button key={s} onClick={() => { setFilterStatus(s); setStatusDropOpen(false); }}
                    className={cn("flex w-full px-3 py-2 text-left text-[12px] hover:bg-muted/50 transition-colors capitalize", filterStatus === s && "bg-muted/30")}>
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
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            {filterCat === "all" ? "All categories" : FOUNDER_CATEGORY_LABELS[filterCat]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {catDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCatDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                <button onClick={() => { setFilterCat("all"); setCatDropOpen(false); }}
                  className={cn("flex w-full px-3 py-2 text-left text-[12px] hover:bg-muted/50 transition-colors", filterCat === "all" && "bg-muted/30")}>
                  All categories
                </button>
                {ALL_CATS.map((cat) => (
                  <button key={cat} onClick={() => { setFilterCat(cat); setCatDropOpen(false); }}
                    className={cn("flex w-full px-3 py-2 text-left text-[12px] hover:bg-muted/50 transition-colors", filterCat === cat && "bg-muted/30")}>
                    {FOUNDER_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {syncStatus === "syncing" ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing history…
            </span>
          ) : lastSyncedAt ? (
            <span
              title={`History synced ${format(new Date(lastSyncedAt), "MMM d, yyyy 'at' h:mm a")}`}
              className="text-[11px] text-muted-foreground/40"
            >
              Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground/40 tabular-nums">
            {sorted.length} sender{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No senders found</p>
            <p className="text-xs text-muted-foreground/50">
              Senders appear once your inbox has loaded threads.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-background border-b border-border/60">
              <tr>
                <SortTh label="Email" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} className="pl-4" />
                <SortTh label="Category" sortKey="category" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="First seen" sortKey="firstSeen" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Last seen" sortKey="lastSeen" current={sortKey} dir={sortDir} onSort={handleSort} className="pr-4" />
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
