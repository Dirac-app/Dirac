"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, FileText, Mail, Trash2, Plus, ChevronUp, ChevronDown, Search, X,
} from "lucide-react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiSidebar } from "@/components/ai-sidebar/ai-sidebar";
import { TOPIC_TAG_LABELS, TOPIC_TAG_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TopicTag, DiracThread } from "@/lib/types";

const PAPER_TRAIL_TOPICS = new Set<TopicTag>([
  "billing", "ci_cd", "monitoring", "shipping", "security", "access", "announcement",
]);

const LS_EXCLUDED = "dirac-pt-excluded";
const LS_MANUAL   = "dirac-pt-manual";
const LS_ORDER    = "dirac-pt-order";

export default function PaperTrailPage() {
  const { threads, categoryMap, topicMap, setSelectedThreadId, selectedThreadId } = useAppState();

  const [excluded,   setExcluded]   = useState<Set<string>>(new Set());
  const [manualIds,  setManualIds]  = useState<Set<string>>(new Set());
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [addQuery,   setAddQuery]   = useState("");
  const [addOpen,    setAddOpen]    = useState(false);

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

  const saveExcluded = (s: Set<string>) => {
    setExcluded(s);
    localStorage.setItem(LS_EXCLUDED, JSON.stringify([...s]));
  };
  const saveManualIds = (s: Set<string>) => {
    setManualIds(s);
    localStorage.setItem(LS_MANUAL, JSON.stringify([...s]));
  };
  const saveGroupOrder = (a: string[]) => {
    setGroupOrder(a);
    localStorage.setItem(LS_ORDER, JSON.stringify(a));
  };

  const removeThread = (id: string) => {
    const nextE = new Set(excluded); nextE.add(id);
    saveExcluded(nextE);
    if (manualIds.has(id)) {
      const nextM = new Set(manualIds); nextM.delete(id);
      saveManualIds(nextM);
    }
  };

  const addThread = (id: string) => {
    if (excluded.has(id)) {
      const nextE = new Set(excluded); nextE.delete(id);
      saveExcluded(nextE);
    }
    const nextM = new Set(manualIds); nextM.add(id);
    saveManualIds(nextM);
    setAddOpen(false);
    setAddQuery("");
  };

  // Build paper trail list
  const paperTrail = threads.filter(t => {
    if (excluded.has(t.id)) return false;
    if (manualIds.has(t.id)) return true;
    const cat    = categoryMap[t.id];
    const topics: TopicTag[] = topicMap[t.id] ?? [];
    return cat === "automated" || topics.some(tp => PAPER_TRAIL_TOPICS.has(tp));
  });

  // Group by topic
  const groupMap: Record<string, DiracThread[]> = {};
  paperTrail.forEach(t => {
    const topics: TopicTag[] = topicMap[t.id] ?? [];
    const key = topics.find(tp => PAPER_TRAIL_TOPICS.has(tp)) ?? topics[0] ?? "other";
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(t);
  });

  const allGroupKeys  = Object.keys(groupMap);
  const orderedKeys   = [
    ...groupOrder.filter(k => allGroupKeys.includes(k)),
    ...allGroupKeys.filter(k => !groupOrder.includes(k)),
  ];

  const moveGroup = (key: string, dir: -1 | 1) => {
    const idx     = orderedKeys.indexOf(key);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= orderedKeys.length) return;
    const next = [...orderedKeys];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    saveGroupOrder(next);
  };

  // Threads available to add (not already in paper trail, matches search)
  const addable = threads.filter(t => {
    if (paperTrail.some(pt => pt.id === t.id)) return false;
    if (!addQuery.trim()) return true;
    const q = addQuery.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.participants.some(p =>
        p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
      )
    );
  });

  return (
    <>
      <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Inbox
            </Link>
            <div className="h-4 w-px bg-border" />
            <FileText className="h-4 w-4 text-primary/70" />
            <h1 className="text-xl font-bold text-foreground">Paper trail</h1>
            <span className="text-sm text-muted-foreground/50">{paperTrail.length} threads</span>

            <button
              onClick={() => setAddOpen(v => !v)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                addOpen
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Add email
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            Receipts, automated notifications, CI/CD alerts, and other machine-sent emails. For reference, not action.
          </p>

          {/* ── Add-email search panel ── */}
          {addOpen && (
            <div className="mt-3 rounded-xl border border-border bg-background p-3 shadow-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 mb-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Search inbox threads to add…"
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 outline-none"
                />
                <button
                  onClick={() => { setAddOpen(false); setAddQuery(""); }}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                {addable.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground/50">
                    {addQuery ? "No matching threads" : "All threads are already in the paper trail"}
                  </p>
                ) : (
                  addable.slice(0, 25).map(t => (
                    <button
                      key={t.id}
                      onClick={() => addThread(t.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      <span className="flex-1 truncate text-xs text-foreground">{t.subject}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/40">
                        {t.participants[0]?.name ?? t.participants[0]?.email}
                      </span>
                      <Plus className="h-3 w-3 shrink-0 text-primary/60" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <ScrollArea className="flex-1">
          {paperTrail.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No automated threads yet</p>
              <p className="text-xs text-muted-foreground/50">
                Receipts, alerts, and notifications will appear here once AI categorizes them.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {orderedKeys.map((key, ki) => {
                const group = groupMap[key];
                if (!group || group.length === 0) return null;
                return (
                  <div key={key}>
                    {/* Group header with reorder controls */}
                    <div className="flex items-center gap-2 border-b border-border/40 bg-muted/25 px-5 py-2">
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        TOPIC_TAG_COLORS[key as TopicTag] ?? "bg-muted text-muted-foreground",
                      )}>
                        #{TOPIC_TAG_LABELS[key as TopicTag] ?? key}
                      </span>
                      <span className="text-xs text-muted-foreground/50">{group.length}</span>

                      {/* Up / down reorder */}
                      <div className="ml-auto flex items-center gap-0.5">
                        <button
                          onClick={() => moveGroup(key, -1)}
                          disabled={ki === 0}
                          title="Move group up"
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveGroup(key, 1)}
                          disabled={ki === orderedKeys.filter(k => groupMap[k]?.length > 0).length - 1}
                          title="Move group down"
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Thread rows */}
                    {group.map(thread => {
                      const sender  = thread.participants[0];
                      const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false });
                      return (
                        <div
                          key={thread.id}
                          className={cn(
                            "group flex w-full items-start gap-3 border-b border-border px-5 py-3 transition-colors hover:bg-accent/20",
                            thread.id === selectedThreadId && "bg-accent/50",
                          )}
                        >
                          {/* Clickable area opens thread */}
                          <button
                            onClick={() => setSelectedThreadId(thread.id)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="truncate text-[13px] font-medium text-foreground">
                                  {thread.subject}
                                </span>
                                <span className="ml-auto shrink-0 tabular-nums text-xs text-muted-foreground/50">
                                  {timeAgo}
                                </span>
                              </div>
                              <p className="truncate text-xs text-muted-foreground/55">
                                {sender?.name ?? sender?.email}
                              </p>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/45">
                                {thread.snippet}
                              </p>
                            </div>
                          </button>

                          {/* Remove button */}
                          <button
                            onClick={() => removeThread(thread.id)}
                            title="Remove from paper trail"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      <AiSidebar />
    </>
  );
}
