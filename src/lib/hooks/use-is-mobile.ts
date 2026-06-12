import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport width is below the mobile breakpoint (< 768px).
 * Safe to use during SSR — returns false until mounted.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
