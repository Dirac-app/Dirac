"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ThreadList } from "@/components/inbox/thread-list";
import { ThreadView } from "@/components/inbox/thread-view";
import { ViewAllView } from "@/components/inbox/view-all-overlay";
import { AiSidebar } from "@/components/ai-sidebar/ai-sidebar";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { aiSidebarOpen, setAiSidebarOpen, selectedThreadId, viewAllOpen } = useAppState();

  return (
    <>
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
                variant="outline"
                size="icon"
                className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-sm z-10 hidden lg:flex"
                onClick={() => setAiSidebarOpen(true)}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open AI sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="hidden lg:flex h-full">
        <AiSidebar />
      </div>
    </>
  );
}
