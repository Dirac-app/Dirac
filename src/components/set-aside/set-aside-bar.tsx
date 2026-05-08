"use client";

import { useState, useEffect } from "react";
import { Layers, X, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SetAsideBar() {
  const { setAsideThreadIds, removeFromSetAside, clearSetAside, threads, setSelectedThreadId, openViewAll } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || setAsideThreadIds.length === 0) return null;

  const setAsideThreads = setAsideThreadIds
    .map(id => threads.find(t => t.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof threads.find>>[];

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="pointer-events-auto w-[480px] max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/5">
        {/* Bar header */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Layers className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold text-foreground mr-auto">
            Set aside
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
              {setAsideThreads.length}
            </span>
          </span>

          <button
            onClick={() => openViewAll(setAsideThreadIds)}
            title="View all"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View all
          </button>

          <button
            onClick={() => setExpanded(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          <button
            onClick={clearSetAside}
            title="Clear all"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thread chips (collapsed) */}
        {!expanded && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 scrollbar-none">
            {setAsideThreads.map(thread => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                title={thread.subject}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors max-w-[160px]"
              >
                <span className="truncate">{thread.participants[0]?.name ?? thread.participants[0]?.email ?? "?"}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); removeFromSetAside(thread.id); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); removeFromSetAside(thread.id); }}}
                  className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Expanded list */}
        {expanded && (
          <div className="max-h-72 overflow-y-auto divide-y divide-border border-t border-border">
            {setAsideThreads.map(thread => (
              <div key={thread.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors group">
                <button
                  onClick={() => setSelectedThreadId(thread.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className={cn(
                    "truncate text-[13px]",
                    thread.isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                  )}>
                    {thread.subject}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/60">
                    {thread.participants[0]?.name ?? thread.participants[0]?.email}
                  </p>
                </button>
                <button
                  onClick={() => removeFromSetAside(thread.id)}
                  className="opacity-0 group-hover:opacity-100 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
