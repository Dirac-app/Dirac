"use client";

import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ThreadList } from "@/components/inbox/thread-list";
import { ThreadView } from "@/components/inbox/thread-view";
import { ViewAllView } from "@/components/inbox/view-all-overlay";
import { AiSidebarSkeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

// Lazy load AiSidebar - only loads when user first interacts with it
const AiSidebar = dynamic(
  () => import("@/components/ai-sidebar/ai-sidebar").then((m) => m.AiSidebar),
  {
    ssr: false,
    loading: () => (
      <div className="hidden lg:flex h-full">
        <AiSidebarSkeleton />
      </div>
    ),
  }
);

// Mobile AI bottom sheet
const AiBottomSheet = dynamic(
  () => import("@/components/ai-sidebar/ai-bottom-sheet").then((m) => m.AiBottomSheet),
  { ssr: false }
);
const AiBottomSheetTrigger = dynamic(
  () => import("@/components/ai-sidebar/ai-bottom-sheet").then((m) => m.AiBottomSheetTrigger),
  { ssr: false }
);

const SLIDE = {
  inbox: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -24 },
  },
  thread: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: 24 },
  },
  viewall: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: 16 },
  },
} as const;

const TRANSITION = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } as const;

export default function InboxPage() {
  const router = useRouter();
  const { aiSidebarOpen, setAiSidebarOpen, selectedThreadId, viewAllOpen, setSelectedThreadId } = useAppState();
  const [isMobile, setIsMobile] = useState(false);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Reset mobile thread view when no thread selected
  useEffect(() => {
    if (!selectedThreadId) {
      setShowThreadOnMobile(false);
    } else if (isMobile) {
      setShowThreadOnMobile(true);
    }
  }, [selectedThreadId, isMobile]);

  const handleBack = () => {
    setShowThreadOnMobile(false);
    const fromBrief = sessionStorage.getItem("dirac:nav-from-brief") === "1";
    if (fromBrief) {
      sessionStorage.removeItem("dirac:nav-from-brief");
      setSelectedThreadId(null);
      router.push("/brief");
    }
  };

  return (
    <>
      {/* Mobile: Show thread list or thread view, not both */}
      {isMobile ? (
        <div className="dirac-panel relative flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {viewAllOpen ? (
              <motion.div
                key="viewall"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.viewall.initial}
                animate={SLIDE.viewall.animate}
                exit={SLIDE.viewall.exit}
                transition={TRANSITION}
              >
                <ViewAllView />
              </motion.div>
            ) : showThreadOnMobile && selectedThreadId ? (
              <motion.div
                key="thread"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.thread.initial}
                animate={SLIDE.thread.animate}
                exit={SLIDE.thread.exit}
                transition={TRANSITION}
              >
                {/* Mobile header with back button + AI trigger */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40 md:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBack}
                      className="touch-target h-9 w-9 shrink-0"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium truncate flex-1 px-1">
                      {sessionStorage.getItem("dirac:nav-from-brief") === "1" ? "Back to Brief" : "Back to inbox"}
                    </span>
                    <AiBottomSheetTrigger />
                  </div>
                  <ThreadView />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="inbox"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.inbox.initial}
                animate={SLIDE.inbox.animate}
                exit={SLIDE.inbox.exit}
                transition={TRANSITION}
              >
                <ThreadList />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Desktop: Show list + detail side by side */
        <div className="dirac-panel relative flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {viewAllOpen ? (
              <motion.div
                key="viewall"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.viewall.initial}
                animate={SLIDE.viewall.animate}
                exit={SLIDE.viewall.exit}
                transition={TRANSITION}
              >
                <ViewAllView />
              </motion.div>
            ) : selectedThreadId ? (
              <motion.div
                key="thread"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.thread.initial}
                animate={SLIDE.thread.animate}
                exit={SLIDE.thread.exit}
                transition={TRANSITION}
              >
                <ThreadView />
              </motion.div>
            ) : (
              <motion.div
                key="inbox"
                className="flex flex-1 overflow-hidden"
                initial={SLIDE.inbox.initial}
                animate={SLIDE.inbox.animate}
                exit={SLIDE.inbox.exit}
                transition={TRANSITION}
              >
                <ThreadList />
              </motion.div>
            )}
          </AnimatePresence>

          {!aiSidebarOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-tour="ai-sidebar"
                  variant="outline"
                  size="icon"
                  className="absolute bottom-4 right-4 h-10 w-10 shadow-sm z-10 hidden lg:flex"
                  onClick={() => setAiSidebarOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Open AI sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* AI Sidebar - hidden on mobile, shown on lg+ */}
      <div className="hidden lg:flex h-full">
        <AiSidebar />
      </div>

      {/* Mobile AI bottom sheet - only rendered on mobile */}
      {isMobile && <AiBottomSheet />}
    </>
  );
}
