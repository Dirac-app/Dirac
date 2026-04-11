"use client";

import { useCallback, useRef, useState } from "react";

export type UndoableActionType = "archive" | "trash" | "star" | "unstar" | "markDone" | "unmarkDone" | "snooze" | "unsnooze";

export interface UndoableAction {
  id: string;
  type: UndoableActionType;
  threadId: string;
  threadSubject?: string;
  timestamp: number;
}

const MAX_UNDO_STACK = 10;

export function useUndo() {
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([]);
  const [lastUndone, setLastUndone] = useState<UndoableAction | null>(null);

  const pushAction = useCallback((action: Omit<UndoableAction, "id" | "timestamp">) => {
    const newAction: UndoableAction = {
      ...action,
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    setUndoStack((prev) => {
      const next = [newAction, ...prev];
      if (next.length > MAX_UNDO_STACK) {
        return next.slice(0, MAX_UNDO_STACK);
      }
      return next;
    });

    setLastUndone(null);
  }, []);

  const undo = useCallback((actionType: UndoableActionType): UndoableAction | null => {
    const actionIndex = undoStack.findIndex((a) => a.type === actionType);
    if (actionIndex === -1) return null;

    const action = undoStack[actionIndex];
    setUndoStack((prev) => prev.filter((_, i) => i !== actionIndex));
    setLastUndone(action);

    return action;
  }, [undoStack]);

  const clearStack = useCallback(() => {
    setUndoStack([]);
  }, []);

  const dismissUndo = useCallback(() => {
    setLastUndone(null);
  }, []);

  return {
    undoStack,
    lastUndone,
    pushAction,
    undo,
    clearStack,
    dismissUndo,
  };
}

export function getUndoLabel(type: UndoableActionType): string {
  switch (type) {
    case "archive": return "Archive";
    case "trash": return "Trash";
    case "star": return "Star";
    case "unstar": return "Unstar";
    case "markDone": return "Mark done";
    case "unmarkDone": return "Unmark done";
    case "snooze": return "Snooze";
    case "unsnooze": return "Unsnooze";
    default: return "Action";
  }
}

export function getUndoAction(type: UndoableActionType): UndoableActionType {
  switch (type) {
    case "archive": return "archive";
    case "trash": return "trash";
    case "star": return "unstar";
    case "unstar": return "star";
    case "markDone": return "unmarkDone";
    case "unmarkDone": return "markDone";
    case "snooze": return "unsnooze";
    case "unsnooze": return "snooze";
    default: return type;
  }
}