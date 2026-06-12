"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldOff, ArrowLeft, Trash2, Search, X, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadScreenedSenders,
  removeScreenedSender,
  unscreenByEmail,
  SCREENER_CHANGED_EVENT,
  type ScreenedSender,
} from "@/lib/screener";
import { formatDistanceToNow } from "date-fns";

export default function ScreenerPage() {
  const [senders, setSenders] = useState<ScreenedSender[]>([]);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSenders(loadScreenedSenders());
  }, []);

  // Stay in sync with changes from other components
  useEffect(() => {
    const refresh = () => setSenders(loadScreenedSenders());
    window.addEventListener(SCREENER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SCREENER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const filtered = senders.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.email.includes(q) || s.name.toLowerCase().includes(q) || s.domain.includes(q);
  });

  // Sort newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime(),
  );

  function handleRemove(id: string) {
    removeScreenedSender(id);
    setSenders(loadScreenedSenders());
  }

  if (!mounted) return null;

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/senders"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Senders
          </Link>
          <div className="h-4 w-px bg-border" />
          <ShieldOff className="h-4 w-4 text-rose-500" />
          <h1
            data-tour="screener-page"
            className="text-xl font-bold text-foreground"
          >
            Screener
          </h1>
          <span className="text-sm text-muted-foreground/50">
            {senders.length} blocked
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          Screened senders are flagged and removed from your main inbox.
          Right-click any thread to screen its sender.
        </p>

        {/* Search */}
        {senders.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter screened senders…"
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
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
              <Shield className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No results" : "No screened senders"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/50">
                {search
                  ? "Try a different search term."
                  : "Right-click any thread in your inbox and choose \"Screen sender\" to block them."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {sorted.map((sender, idx) => (
              <div
                key={sender.id}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3 hover:bg-accent/20 transition-colors",
                  idx !== sorted.length - 1 && "border-b border-border/40",
                )}
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-[11px] font-semibold text-rose-500">
                  {sender.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("") || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {sender.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground/40 tabular-nums">
                      {formatDistanceToNow(new Date(sender.screenedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground/60">{sender.email}</p>
                </div>

                {/* Unscreen */}
                <button
                  onClick={() => handleRemove(sender.id)}
                  title="Remove from screener"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
