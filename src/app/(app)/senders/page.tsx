"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users, ShieldOff, GripVertical, ArrowLeft, Mail,
  ChevronDown, ChevronRight, Search, X,
} from "lucide-react";
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

// ── Sender data type ─────────────────────────────────────────────────────────

interface SenderInfo {
  email: string;
  name: string;
  domain: string;
  threadCount: number;
  lastSeenAt: string;
  category: FounderCategory | "unknown";
}

const ALL_CATS: FounderCategory[] = [
  "team", "investor", "customer", "vendor", "recruiter",
  "pr_media", "outreach", "personal", "automated",
];

const CAT_ORDER = Object.fromEntries(ALL_CATS.map((c, i) => [c, i])) as Record<string, number>;

// ── Sender card ──────────────────────────────────────────────────────────────

function SenderCard({
  sender,
  isScreened,
  isDragging,
  onDragStart,
}: {
  sender: SenderInfo;
  isScreened: boolean;
  isDragging: boolean;
  onDragStart: (email: string) => void;
}) {
  const initials = sender.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      draggable
      onDragStart={() => onDragStart(sender.email)}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 cursor-grab transition-all select-none",
        isDragging && "opacity-40 scale-95",
        isScreened && "opacity-50",
      )}
      title={sender.email}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />

      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initials || "?"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground leading-snug">
          {sender.name || sender.email}
        </p>
        <p className="truncate text-[11px] text-muted-foreground/60">{sender.email}</p>
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[11px] tabular-nums text-muted-foreground/50">
          {sender.threadCount} thread{sender.threadCount !== 1 ? "s" : ""}
        </span>
        {isScreened && (
          <span className="text-[10px] font-medium text-rose-500">screened</span>
        )}
      </div>
    </div>
  );
}

// ── Category column ──────────────────────────────────────────────────────────

function CategoryColumn({
  category,
  senders,
  screenedEmails,
  draggingEmail,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
}: {
  category: FounderCategory | "unknown";
  senders: SenderInfo[];
  screenedEmails: Set<string>;
  draggingEmail: string | null;
  isOver: boolean;
  onDragOver: (e: React.DragEvent, cat: string) => void;
  onDragLeave: () => void;
  onDrop: (cat: string) => void;
  onDragStart: (email: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = category === "unknown" ? "Uncategorized" : FOUNDER_CATEGORY_LABELS[category];
  const colorClass = category !== "unknown" ? FOUNDER_CATEGORY_COLORS[category] : "bg-muted/50 text-muted-foreground";

  return (
    <div
      onDragOver={(e) => onDragOver(e, category)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(category)}
      className={cn(
        "flex flex-col rounded-xl border transition-colors duration-150",
        isOver
          ? "border-primary/50 bg-primary/5"
          : "border-border/40 bg-muted/10",
      )}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 px-3 py-2.5 text-left"
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        }
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", colorClass)}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground/50 ml-auto">{senders.length}</span>
      </button>

      {/* Senders list */}
      {!collapsed && (
        <div className="flex flex-col gap-1.5 px-3 pb-3 min-h-[52px]">
          {senders.length === 0 ? (
            <div className={cn(
              "flex items-center justify-center rounded-lg border border-dashed py-4 text-xs text-muted-foreground/40 transition-colors",
              isOver && "border-primary/40 text-primary/60",
            )}>
              Drop senders here
            </div>
          ) : (
            senders.map((s) => (
              <SenderCard
                key={s.email}
                sender={s}
                isScreened={screenedEmails.has(s.email)}
                isDragging={draggingEmail === s.email}
                onDragStart={onDragStart}
              />
            ))
          )}
          {senders.length > 0 && isOver && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-primary/40 py-2 text-xs text-primary/60">
              Move here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SendersPage() {
  const { threads, categoryMap } = useAppState();

  const [overrides, setOverrides] = useState(loadSenderOverrides());
  const [screenedEmails, setScreenedEmails] = useState<Set<string>>(
    () => new Set(loadScreenedSenders().map((s) => s.email)),
  );
  const [draggingEmail, setDraggingEmail] = useState<string | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Stay in sync with override / screener changes (other tabs or same tab)
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
      setScreenedEmails(new Set(loadScreenedSenders().map((s) => s.email)));
    window.addEventListener(SCREENER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SCREENER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Build unique senders from threads
  const senders = useMemo<SenderInfo[]>(() => {
    const map = new Map<string, SenderInfo>();
    for (const thread of threads) {
      for (const p of thread.participants) {
        if (!p.email) continue;
        const addr = p.email.toLowerCase();
        const existing = map.get(addr);
        if (existing) {
          existing.threadCount++;
          if (thread.lastMessageAt > existing.lastSeenAt)
            existing.lastSeenAt = thread.lastMessageAt;
        } else {
          const overrideCat = overrides.find((r) => {
            if (r.pattern.includes("@")) return r.pattern === addr;
            const domain = addr.split("@")[1] ?? "";
            return domain === r.pattern || domain.endsWith(`.${r.pattern}`);
          });
          const aiCat = categoryMap[thread.id] as FounderCategory | undefined;
          map.set(addr, {
            email: addr,
            name: p.name || addr,
            domain: addr.split("@")[1] ?? "",
            threadCount: 1,
            lastSeenAt: thread.lastMessageAt,
            category: overrideCat?.category ?? aiCat ?? "unknown",
          });
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.threadCount - a.threadCount,
    );
  }, [threads, categoryMap, overrides]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return senders;
    const q = search.toLowerCase();
    return senders.filter(
      (s) =>
        s.email.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.domain.includes(q),
    );
  }, [senders, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Partial<Record<FounderCategory | "unknown", SenderInfo[]>> = {};
    for (const s of filtered) {
      const key = s.category;
      if (!map[key]) map[key] = [];
      map[key]!.push(s);
    }
    return map;
  }, [filtered]);

  const activeCats = useMemo(
    () =>
      (Object.keys(grouped) as (FounderCategory | "unknown")[]).sort(
        (a, b) => (CAT_ORDER[a] ?? 99) - (CAT_ORDER[b] ?? 99),
      ),
    [grouped],
  );

  // ── Drag handlers ────────────────────────────────────────
  const handleDragStart = useCallback((email: string) => {
    setDraggingEmail(email);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, cat: string) => {
      e.preventDefault();
      setOverCat(cat);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setOverCat(null);
  }, []);

  const handleDrop = useCallback(
    (targetCat: string) => {
      setOverCat(null);
      if (!draggingEmail || targetCat === "unknown") {
        setDraggingEmail(null);
        return;
      }
      const sender = senders.find((s) => s.email === draggingEmail);
      if (!sender || sender.category === targetCat) {
        setDraggingEmail(null);
        return;
      }
      addSenderOverride(draggingEmail, targetCat as FounderCategory);
      setOverrides(loadSenderOverrides());
      setDraggingEmail(null);
    },
    [draggingEmail, senders],
  );

  const totalSenders = senders.length;

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-primary/70" />
          <h1
            data-tour="senders"
            className="text-xl font-bold text-foreground"
          >
            Senders
          </h1>
          <span className="text-sm text-muted-foreground/50">
            {totalSenders} senders
          </span>

          <Link
            href="/senders/screener"
            data-tour="screener"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Screener
          </Link>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          All senders from your threads, organised by relationship type. Drag a sender to reassign their category.
        </p>

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email, or domain…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground/40 hover:text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {activeCats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No senders found</p>
            <p className="text-xs text-muted-foreground/50">
              Senders appear here once your inbox has loaded threads.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeCats.map((cat) => (
              <CategoryColumn
                key={cat}
                category={cat}
                senders={grouped[cat] ?? []}
                screenedEmails={screenedEmails}
                draggingEmail={draggingEmail}
                isOver={overCat === cat}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
