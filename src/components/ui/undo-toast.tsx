"use client";

/**
 * UndoToast — toast notification with undo button.
 * Shows when a thread action is performed with a 5-second window to undo.
 */

import { useState, useEffect } from "react";
import { Undo2, X, Archive, Trash2, Star, MailOpen, MailX, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UndoableActionType } from "@/lib/undo";
import { getUndoLabel } from "@/lib/undo";

export interface UndoToastProps {
  /** The current undo action data */
  action: {
    id: string;
    type: UndoableActionType;
    threadId: string;
    threadSubject?: string;
  };
  /** Time remaining in ms */
  timeLeft: number;
  /** Called when user clicks undo */
  onUndo: () => void;
  /** Called when user dismisses or time expires */
  onDismiss: () => void;
  /** Total duration in ms (default 5000) */
  duration?: number;
}

// Icons for each action type
const icons: Record<UndoableActionType, typeof Archive> = {
  archive: Archive,
  unarchive: Archive,
  trash: Trash2,
  untrash: Trash2,
  delete: Trash2,
  star: Star,
  unstar: Star,
  markRead: MailOpen,
  markUnread: MailX,
  markDone: CheckCircle2,
  unmarkDone: CheckCircle2,
  snooze: Clock,
  unsnooze: Clock,
  batch_archive: Archive,
  batch_star: Star,
  bundle: Archive,
};

// Action types that cannot be undone
const irreversibleActions = new Set(["delete"]);

export function UndoToast({ 
  action, 
  timeLeft, 
  onUndo, 
  onDismiss,
  duration = 5000 
}: UndoToastProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  
  const Icon = icons[action.type] ?? Archive;
  const canUndo = !irreversibleActions.has(action.type);
  
  // Enter animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Progress bar updates
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, timeLeft);
      setProgress((remaining / duration) * 100);
    }, 50);

    return () => clearInterval(interval);
  }, [timeLeft, duration]);

  // Auto-dismiss when time runs out
  useEffect(() => {
    if (timeLeft <= 0) {
      onDismiss();
    }
  }, [timeLeft, onDismiss]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card px-4 py-3 shadow-lg transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      role="alert"
    >
      {/* Progress bar */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-75"
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">
            {getUndoLabel(action.type, 1)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {action.threadSubject ?? action.threadId}
          </p>
        </div>
        
        {canUndo && (
          <button
            onClick={onUndo}
            className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-accent transition-colors"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
        )}
        
        <button
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
