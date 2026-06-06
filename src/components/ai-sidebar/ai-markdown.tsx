"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const PROSE =
  "prose prose-sm prose-neutral dark:prose-invert max-w-none " +
  "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 " +
  "prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1 " +
  "prose-table:my-2 prose-table:text-[12px] prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 " +
  "prose-th:border prose-td:border prose-th:border-border/60 prose-td:border-border/60 " +
  "prose-strong:font-semibold prose-strong:text-foreground";

export function AiMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn(PROSE, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
