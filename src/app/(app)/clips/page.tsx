"use client";

import { format } from "date-fns";
import { ArrowLeft, Bookmark, Trash2, Link as LinkIcon, Quote, Type } from "lucide-react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/store";

const TYPE_ICONS = {
  text:  Type,
  link:  LinkIcon,
  quote: Quote,
} as const;

const TYPE_COLORS = {
  text:  "text-sky-600/70 dark:text-sky-400/60 bg-sky-500/8 dark:bg-sky-400/10",
  link:  "text-violet-600/70 dark:text-violet-400/60 bg-violet-500/8 dark:bg-violet-400/10",
  quote: "text-amber-600/70 dark:text-amber-400/60 bg-amber-500/8 dark:bg-amber-400/10",
} as const;

function ClipCard({ clip, onRemove }: { clip: Clip; onRemove: () => void }) {
  const Icon = TYPE_ICONS[clip.type];
  const isLink = clip.type === "link";

  return (
    <div className="group flex flex-col gap-2.5 rounded-xl border border-border bg-background p-4 hover:border-border/80 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0", TYPE_COLORS[clip.type])}>
          <Icon className="h-2.5 w-2.5" />
          {clip.type}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/60">
          {clip.threadSubject}
        </span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      {isLink ? (
        <a
          href={clip.content}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {clip.content}
        </a>
      ) : clip.type === "quote" ? (
        <blockquote className="border-l-2 border-amber-400/50 pl-3 text-sm text-foreground/80 italic leading-relaxed">
          {clip.content}
        </blockquote>
      ) : (
        <p className="text-sm text-foreground/80 leading-relaxed">{clip.content}</p>
      )}

      <p className="text-[11px] text-muted-foreground/40">
        {format(new Date(clip.createdAt), "MMM d, yyyy · h:mm a")}
      </p>
    </div>
  );
}

export default function ClipsPage() {
  const { clips, removeClip } = useAppState();

  // Group by date
  const grouped: Record<string, Clip[]> = {};
  clips.forEach(clip => {
    const key = format(new Date(clip.createdAt), "MMMM d, yyyy");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(clip);
  });

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      {/* Header */}
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
          <Bookmark className="h-4 w-4 text-primary/70" />
          <h1 className="text-xl font-bold text-foreground">Clip library</h1>
          <span className="text-sm text-muted-foreground/50">{clips.length} clips</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          Snippets, links, and quotes clipped from your emails.
        </p>
      </div>

      <ScrollArea className="flex-1">
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
            <Bookmark className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No clips yet</p>
            <p className="text-xs text-muted-foreground/50">
              Select text in any email and click the clip button to save it here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {Object.entries(grouped).map(([date, dateClips]) => (
              <div key={date}>
                <div className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 bg-muted/20">
                  {date}
                </div>
                {/* CSS columns = masonry: each card keeps its natural height */}
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 px-5 py-4">
                  {dateClips.map(clip => (
                    <div key={clip.id} className="mb-3 break-inside-avoid">
                      <ClipCard clip={clip} onRemove={() => removeClip(clip.id)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
