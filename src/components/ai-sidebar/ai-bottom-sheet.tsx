"use client";

/**
 * Mobile AI bottom sheet — wraps the AiSidebar in a vaul Drawer.
 * - Opens at ~55% viewport height
 * - Drag up to snap to full screen (~95%)
 * - Drag down past threshold to close
 */

import { useState } from "react";
import { Drawer } from "vaul";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { useAppState } from "@/lib/store";
import { AiSidebarSkeleton } from "@/components/ui/skeleton";

const AiSidebar = dynamic(
  () => import("@/components/ai-sidebar/ai-sidebar").then((m) => m.AiSidebar),
  {
    ssr: false,
    loading: () => <AiSidebarSkeleton />,
  },
);

const SNAP_HALF = 0.55;
const SNAP_FULL = 0.95;

export function AiBottomSheet() {
  const { aiSidebarOpen, setAiSidebarOpen } = useAppState();
  const [snap, setSnap] = useState<number | string | null>(SNAP_HALF);

  const handleOpenChange = (open: boolean) => {
    setAiSidebarOpen(open);
    if (open) setSnap(SNAP_HALF);
  };

  return (
    <Drawer.Root
      open={aiSidebarOpen}
      onOpenChange={handleOpenChange}
      snapPoints={[SNAP_HALF, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
    >
      {/* Dim overlay — only visible when drawer is up */}
      {aiSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setAiSidebarOpen(false)}
        />
      )}

      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-background md:hidden outline-none"
          style={{ height: `${(typeof snap === "number" ? snap : SNAP_HALF) * 100}dvh` }}
        >
          {/* Drag handle */}
          <div className="flex shrink-0 cursor-grab items-center justify-center pb-2 pt-3 active:cursor-grabbing">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>

          {/* AI sidebar content — fills available height */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AiSidebar />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Floating trigger button shown in mobile thread view header */
export function AiBottomSheetTrigger() {
  const { aiSidebarOpen, setAiSidebarOpen } = useAppState();

  return (
    <button
      onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors touch-target"
      aria-label="AI assistant"
    >
      <Sparkles
        className={
          aiSidebarOpen
            ? "h-4 w-4 text-primary"
            : "h-4 w-4 text-muted-foreground"
        }
        strokeWidth={1.75}
      />
    </button>
  );
}
