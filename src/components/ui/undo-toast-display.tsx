"use client";

/**
 * UndoToastDisplay — renders the undo toast when there's an action to undo.
 * Positioned at bottom-right like other toasts.
 */

import { useEffect, useState, useCallback } from "react";
import { UndoToast } from "./undo-toast";
import { useAppState } from "@/lib/store";
import type { SnoozeState } from "@/lib/types";
import type { DiracThread } from "@/lib/types";

export function UndoToastDisplay() {
  const {
    currentUndo,
    performUndo,
    dismissUndo,
    unarchiveThread,
    untrashThread,
    toggleStarred,
    markThreadRead,
    markThreadUnread,
    markDone,
    unmarkDone,
    snoozeThread,
    unsnoozeThread,
  } = useAppState();
  
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5000);

  // Sync with currentUndo
  useEffect(() => {
    if (currentUndo?.action) {
      setTimeLeft(currentUndo.timeLeft);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [currentUndo]);

  // Countdown timer
  useEffect(() => {
    if (!visible || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 50;
        return next > 0 ? next : 0;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [visible, timeLeft]);

  // Auto-dismiss when time runs out
  useEffect(() => {
    if (timeLeft <= 0 && visible) {
      dismissUndo();
      setVisible(false);
    }
  }, [timeLeft, visible, dismissUndo]);

  const handleUndo = useCallback(() => {
    const action = performUndo();
    setVisible(false);
    if (!action) return;

    switch (action.type) {
      case "archive":
        unarchiveThread(action.threadId, action.metadata?.thread as DiracThread | undefined);
        break;
      case "trash":
        untrashThread(action.threadId, action.metadata?.thread as DiracThread | undefined);
        break;
      case "star":
      case "unstar":
        // skipUndo=true to avoid pushing a new undo entry for the inverse
        toggleStarred(action.threadId, true);
        break;
      case "markRead":
        markThreadUnread(action.threadId);
        break;
      case "markUnread":
        // skipUndo=true to avoid loop
        markThreadRead(action.threadId, true);
        break;
      case "markDone":
        unmarkDone(action.threadId);
        break;
      case "unmarkDone":
        // skipUndo=true to avoid loop
        markDone(action.threadId, true);
        break;
      case "snooze":
        unsnoozeThread(action.threadId);
        break;
      case "unsnooze": {
        const snoozeState = action.metadata?.snooze as SnoozeState | undefined;
        if (snoozeState) {
          // skipUndo=true to avoid loop
          snoozeThread(action.threadId, snoozeState, true);
        }
        break;
      }
      case "batch_archive": {
        const threadIds = action.metadata?.threadIds as string[] | undefined;
        const savedThreads = action.metadata?.threads as DiracThread[] | undefined;
        if (threadIds) {
          threadIds.forEach((id, i) =>
            unarchiveThread(id, savedThreads?.[i]),
          );
        }
        break;
      }
      case "batch_star": {
        const threadIds = action.metadata?.threadIds as string[] | undefined;
        if (threadIds) {
          // skipUndo=true to avoid cascading new undo entries
          threadIds.forEach((id) => toggleStarred(id, true));
        }
        break;
      }
      case "bundle": {
        // Emit a custom event so BriefView can un-bundle the group
        const bundleKey = action.metadata?.bundleKey as string | undefined;
        const threadIds = action.metadata?.threadIds as string[] | undefined;
        if (bundleKey !== undefined) {
          window.dispatchEvent(
            new CustomEvent("dirac:undo-bundle", {
              detail: { bundleKey, threadIds },
            }),
          );
        }
        break;
      }
      // "delete" is intentionally omitted — permanent deletes cannot be reversed
      default:
        break;
    }
  }, [
    performUndo,
    unarchiveThread,
    untrashThread,
    toggleStarred,
    markThreadRead,
    markThreadUnread,
    markDone,
    unmarkDone,
    snoozeThread,
    unsnoozeThread,
  ]);

  const handleDismiss = useCallback(() => {
    dismissUndo();
    setVisible(false);
  }, [dismissUndo]);

  if (!visible || !currentUndo?.action) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80">
      <UndoToast
        action={currentUndo.action}
        timeLeft={timeLeft}
        onUndo={handleUndo}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
