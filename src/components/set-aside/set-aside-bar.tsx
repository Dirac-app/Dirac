"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  X,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  MailOpen,
  Archive,
  Trash2,
  CheckCircle2,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function SetAsideBar() {
  const {
    setAsideThreadIds,
    removeFromSetAside,
    clearSetAside,
    threads,
    setSelectedThreadId,
    openViewAll,
    markThreadRead,
    markDone,
    archiveThread,
    trashThread,
    addToAiContext,
    setAiSidebarOpen,
    clearAiContext,
  } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const runBulkAction = useCallback(
    (action: "read" | "done" | "archive" | "trash" | "ai") => {
      const ids = [...setAsideThreadIds];
      if (ids.length === 0) return;

      if (action === "ai") {
        clearAiContext();
        for (const id of ids) {
          const thread = threads.find((t) => t.id === id);
          if (thread) addToAiContext({ id, label: thread.subject });
        }
        setAiSidebarOpen(true);
        return;
      }

      for (const id of ids) {
        switch (action) {
          case "read":
            markThreadRead(id);
            break;
          case "done":
            markDone(id);
            removeFromSetAside(id);
            break;
          case "archive":
            archiveThread(id);
            removeFromSetAside(id);
            break;
          case "trash":
            trashThread(id);
            removeFromSetAside(id);
            break;
        }
      }
    },
    [
      setAsideThreadIds,
      threads,
      markThreadRead,
      markDone,
      archiveThread,
      trashThread,
      removeFromSetAside,
      clearAiContext,
      addToAiContext,
      setAiSidebarOpen,
    ],
  );

  if (!mounted || setAsideThreadIds.length === 0) return null;

  const setAsideThreads = setAsideThreadIds
    .map((id) => threads.find((t) => t.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof threads.find>>[];

  const count = setAsideThreads.length;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <div className="pointer-events-auto w-[520px] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <Layers className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold text-foreground shrink-0">
            Set aside
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
              {count}
            </span>
          </span>

          <div className="ml-auto flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Bulk actions for ${count} threads`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => runBulkAction("read")}>
                  <MailOpen className="h-3.5 w-3.5" />
                  Mark all as read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulkAction("done")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark all as done
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulkAction("archive")}>
                  <Archive className="h-3.5 w-3.5" />
                  Archive all
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulkAction("ai")}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Add all to AI context
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => runBulkAction("trash")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-0.5 h-4 w-px bg-border" />

            <button
              onClick={() => openViewAll(setAsideThreadIds)}
              title="View all"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View all
            </button>

            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={expanded ? "Collapse list" : "Expand list"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            <button
              onClick={clearSetAside}
              title="Clear list without acting on threads"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!expanded && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 scrollbar-none">
            {setAsideThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                title={thread.subject}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors max-w-[160px]"
              >
                <span className="truncate">
                  {thread.participants[0]?.name ?? thread.participants[0]?.email ?? "?"}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromSetAside(thread.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      removeFromSetAside(thread.id);
                    }
                  }}
                  className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </button>
            ))}
          </div>
        )}

        {expanded && (
          <div className="max-h-72 overflow-y-auto divide-y divide-border border-t border-border">
            {setAsideThreads.map((thread) => (
              <div
                key={thread.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors group"
              >
                <button
                  onClick={() => setSelectedThreadId(thread.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={cn(
                      "truncate text-[13px]",
                      thread.isUnread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/80",
                    )}
                  >
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
