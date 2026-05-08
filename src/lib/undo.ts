"use client";

import { useCallback, useEffect, useState, useRef } from "react";

export type UndoableActionType = 
  | "archive" 
  | "trash" 
  | "delete"
  | "star" 
  | "unstar" 
  | "markRead" 
  | "markUnread"
  | "markDone" 
  | "unmarkDone" 
  | "snooze" 
  | "unsnooze";

export interface UndoableAction {
  id: string;
  type: UndoableActionType;
  threadId: string;
  threadSubject?: string;
  timestamp: number;
  // Store previous state for undo
  previousState?: {
    isUnread?: boolean;
    isStarred?: boolean;
    isDone?: boolean;
    isSnoozed?: boolean;
  };
  // Additional context for restore
  metadata?: Record<string, unknown>;
}

const MAX_UNDO_STACK = 10;
const UNDO_TIMEOUT_MS = 5000; // 5 seconds

export interface UndoState {
  action: UndoableAction;
  timeLeft: number;
}

export function useUndoSystem() {
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([]);
  const [currentUndo, setCurrentUndo] = useState<UndoState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (!currentUndo) return;

    // Clear any existing countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    const startTime = currentUndo.action.timestamp;
    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, UNDO_TIMEOUT_MS - elapsed);
      setCurrentUndo(prev => prev ? { ...prev, timeLeft: remaining } : null);
    };

    countdownRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [currentUndo?.action.timestamp]);

  // Auto-dismiss effect
  useEffect(() => {
    if (!currentUndo || currentUndo.timeLeft <= 0) {
      if (currentUndo && currentUndo.timeLeft <= 0) {
        // Time expired, clear the undo
        setCurrentUndo(null);
        setUndoStack(prev => prev.filter(a => a.id !== currentUndo.action.id));
      }
      return;
    }

    // Set timeout to clear undo after duration
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCurrentUndo(null);
      setUndoStack(prev => prev.filter(a => a.id !== currentUndo.action.id));
    }, currentUndo.timeLeft);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentUndo?.timeLeft]);

  const pushAction = useCallback((
    action: Omit<UndoableAction, "id" | "timestamp">,
    showToast: boolean = true
  ) => {
    const newAction: UndoableAction = {
      ...action,
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    setUndoStack(prev => {
      const next = [newAction, ...prev];
      if (next.length > MAX_UNDO_STACK) {
        return next.slice(0, MAX_UNDO_STACK);
      }
      return next;
    });

    if (showToast) {
      setCurrentUndo({ action: newAction, timeLeft: UNDO_TIMEOUT_MS });
    }

    return newAction;
  }, []);

  const undo = useCallback((actionType?: UndoableActionType): UndoableAction | null => {
    let actionToUndo: UndoableAction | null = null;

    if (actionType) {
      // Find the most recent action of this type
      actionToUndo = undoStack.find(a => 
        a.type === actionType || getInverseAction(a.type) === actionType
      ) ?? null;
    } else {
      // Undo the most recent action
      actionToUndo = currentUndo?.action ?? undoStack[0] ?? null;
    }

    if (!actionToUndo) return null;

    // Remove from stack
    setUndoStack(prev => prev.filter(a => a.id !== actionToUndo!.id));
    setCurrentUndo(null);

    return actionToUndo;
  }, [undoStack, currentUndo]);

  const clearStack = useCallback(() => {
    setUndoStack([]);
    setCurrentUndo(null);
  }, []);

  const dismissUndo = useCallback(() => {
    setCurrentUndo(null);
  }, []);

  // Get current undo action for display
  const getCurrentUndo = useCallback((): UndoableAction | null => {
    return currentUndo?.action ?? null;
  }, [currentUndo]);

  return {
    undoStack,
    currentUndo,
    pushAction,
    undo,
    clearStack,
    dismissUndo,
    getCurrentUndo,
    timeLeft: currentUndo?.timeLeft ?? 0,
  };
}

// Helper functions
export function getUndoLabel(type: UndoableActionType, count: number = 1): string {
  const singleLabels: Record<UndoableActionType, string> = {
    archive: "Archived",
    trash: "Moved to trash",
    delete: "Deleted",
    star: "Starred",
    unstar: "Unstarred",
    markRead: "Marked as read",
    markUnread: "Marked as unread",
    markDone: "Marked as done",
    unmarkDone: "Unmarked as done",
    snooze: "Snoozed",
    unsnooze: "Unsnoozed",
  };

  if (count === 1) {
    return singleLabels[type] ?? "Action";
  }

  const pluralLabels: Record<UndoableActionType, string> = {
    archive: "Archived",
    trash: "Moved to trash",
    delete: "Deleted",
    star: "Starred",
    unstar: "Unstarred",
    markRead: "Marked as read",
    markUnread: "Marked as unread",
    markDone: "Marked as done",
    unmarkDone: "Unmarked as done",
    snooze: "Snoozed",
    unsnooze: "Unsnoozed",
  };

  return pluralLabels[type] ?? "Action";
}

export function getUndoDescription(type: UndoableActionType, subject?: string, count: number = 1): string {
  if (count > 1) {
    return `${count} threads`;
  }
  return subject ?? "this thread";
}

// Get the inverse action for undo
// Returns the opposite action to restore the previous state
export function getInverseAction(type: UndoableActionType): UndoableActionType {
  switch (type) {
    case "archive":
      return "archive"; // Cannot truly undo archive, but provide a no-op
    case "trash":
      return "trash";  // Cannot truly undo trash, but provide a no-op  
    case "delete":
      return "delete"; // Cannot undo delete at all
    case "star":
      return "unstar";
    case "unstar":
      return "star";
    case "markRead":
      return "markUnread";
    case "markUnread":
      return "markRead";
    case "markDone":
      return "unmarkDone";
    case "unmarkDone":
      return "markDone";
    case "snooze":
      return "unsnooze";
    case "unsnooze":
      return "snooze";
    default:
      return type;
  }
}

// Get the button label for undo
export function getUndoButtonLabel(type: UndoableActionType): string {
  switch (type) {
    case "archive": return "Undo archive";
    case "trash": return "Restore";
    case "delete": return "Cannot undo";
    case "star": return "Unstar";
    case "unstar": return "Star";
    case "markRead": return "Mark unread";
    case "markUnread": return "Mark read";
    case "markDone": return "Unmark done";
    case "unmarkDone": return "Mark done";
    case "snooze": return "Unsnooze";
    case "unsnooze": return "Snooze";
    default: return "Undo";
  }
}
