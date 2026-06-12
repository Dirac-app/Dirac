import { useCallback, useRef } from "react";

const DEFAULT_DELAY = 500; // ms

interface LongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
}

/**
 * Returns event handlers that fire `onLongPress` after `delay` ms of continuous press.
 * Cancels if the pointer moves more than `moveThreshold` px.
 */
export function useLongPress(
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void,
  delay = DEFAULT_DELAY,
): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      fired.current = false;
      const pos =
        "touches" in e
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : { x: e.clientX, y: e.clientY };
      startPos.current = pos;
      timerRef.current = setTimeout(() => {
        fired.current = true;
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current) return;
    const dx = e.touches[0].clientX - startPos.current.x;
    const dy = e.touches[0].clientY - startPos.current.y;
    // Cancel long press if user moves more than 8px (they're scrolling or swiping)
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancel();
  }, [cancel]);

  return {
    onMouseDown: start as (e: React.MouseEvent) => void,
    onMouseUp: cancel as (e: React.MouseEvent) => void,
    onMouseLeave: cancel as (e: React.MouseEvent) => void,
    onTouchStart: start as (e: React.TouchEvent) => void,
    onTouchEnd: cancel as (e: React.TouchEvent) => void,
    onTouchMove,
  };
}
