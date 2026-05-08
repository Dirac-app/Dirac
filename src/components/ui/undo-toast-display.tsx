"use client";

/**
 * UndoToastDisplay — renders the undo toast when there's an action to undo.
 * Positioned at bottom-right like other toasts.
 */

import { useEffect, useState, useCallback } from "react";
import { UndoToast } from "./undo-toast";
import { useAppState } from "@/lib/store";
import { getInverseAction, type UndoableActionType } from "@/lib/undo";

export function UndoToastDisplay() {
  const {
    currentUndo,
    dismissUndo,
    // These would need to be exposed from the app state for full restore
    // For now we just show the toast and allow dismiss
  } = useAppState() as {
    currentUndo: { action: { id: string; type: UndoableActionType; threadId: string; threadSubject?: string }; timeLeft: number } | null;
    dismissUndo: () => void;
  };
  
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
    // In a full implementation, this would call the appropriate restore function
    // For now we just dismiss the toast
    dismissUndo();
    setVisible(false);
  }, [dismissUndo]);

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
