"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

export function ThreadCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 px-6 py-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-full opacity-50" />
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function ThreadViewSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-px" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 p-4">
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function AiSidebarSkeleton() {
  return (
    <div className="flex h-full w-[320px] flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="flex-1 space-y-4 p-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
      <div className="border-t border-border p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function ComposePanelSkeleton() {
  return (
    <div className="fixed bottom-4 right-4 w-[400px] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-32 w-full rounded" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}