"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Sunrise, Sparkles, ArrowRight } from "lucide-react";
import { useAppState } from "@/lib/store";
import type { InboxTooltipId } from "@/lib/users-db";

interface TooltipConfig {
  id: InboxTooltipId;
  tourKey: string;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right";
  actionLabel?: string;
  onAction?: (helpers: {
    setAiSidebarOpen: (open: boolean) => void;
    setPendingAiQuery: (q: string | null) => void;
  }) => void;
  desktopOnly?: boolean;
}

const TOOLTIPS: TooltipConfig[] = [
  {
    id: "morning_brief",
    tourKey: "morning-brief",
    title: "Morning Brief",
    placement: "bottom",
    body: "Your first brief arrives with what matters and a plan for each thread. Everything else is sorted in the background.",
    actionLabel: "Open Morning Brief",
    onAction: () => {
      window.dispatchEvent(new CustomEvent("dirac:open-morning-briefing"));
    },
  },
  {
    id: "ai_sidebar",
    tourKey: "ai-sidebar",
    title: "AI copilot",
    placement: "left",
    body: "Ask Dirac anything — reply, sort, or archive in plain language.",
    actionLabel: "Try an example",
    desktopOnly: true,
    onAction: ({ setAiSidebarOpen, setPendingAiQuery }) => {
      setAiSidebarOpen(true);
      setPendingAiQuery("What in my inbox needs a reply today?");
    },
  },
];

const CARD_WIDTH = 300;

function findTourAnchor(tourKey: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${tourKey}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

function SpotlightCutout({ rect }: { rect: DOMRect }) {
  const pad = 6;
  return (
    <div
      className="pointer-events-none fixed z-[198] rounded-sm ring-2 ring-[#FF8A3D] ring-offset-2 ring-offset-transparent"
      style={{
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
      }}
      aria-hidden
    />
  );
}

function PointerArrow({
  cardRect,
  anchorRect,
  placement,
}: {
  cardRect: DOMRect;
  anchorRect: DOMRect;
  placement: "top" | "bottom" | "left" | "right";
}) {
  const anchorCx = anchorRect.left + anchorRect.width / 2;
  const anchorCy = anchorRect.top + anchorRect.height / 2;
  let x = cardRect.left + cardRect.width / 2;
  let y = cardRect.top + cardRect.height / 2;

  if (placement === "bottom") {
    x = Math.min(Math.max(anchorCx, cardRect.left + 16), cardRect.right - 16);
    y = cardRect.top;
  } else if (placement === "top") {
    x = Math.min(Math.max(anchorCx, cardRect.left + 16), cardRect.right - 16);
    y = cardRect.bottom;
  } else if (placement === "left") {
    x = cardRect.right;
    y = Math.min(Math.max(anchorCy, cardRect.top + 20), cardRect.bottom - 20);
  } else {
    x = cardRect.left;
    y = Math.min(Math.max(anchorCy, cardRect.top + 20), cardRect.bottom - 20);
  }

  const dx = anchorCx - x;
  const dy = anchorCy - y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <div
      className="pointer-events-none fixed z-[199] h-0.5 origin-left bg-[#FF8A3D]/70"
      style={{
        left: x,
        top: y,
        width: Math.max(24, len - 8),
        transform: `rotate(${angle}deg)`,
      }}
      aria-hidden
    />
  );
}

function computeCardLayout(anchorRect: DOMRect, placement: TooltipConfig["placement"]) {
  const gap = 14;
  let top = anchorRect.bottom + gap;
  let left = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2;

  if (placement === "top") {
    top = anchorRect.top - gap - 120;
    left = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2;
  } else if (placement === "left") {
    top = anchorRect.top + anchorRect.height / 2 - 72;
    left = anchorRect.left - CARD_WIDTH - gap;
  } else if (placement === "right") {
    top = anchorRect.top + anchorRect.height / 2 - 72;
    left = anchorRect.right + gap;
  }

  left = Math.max(12, Math.min(left, window.innerWidth - CARD_WIDTH - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - 160));

  return { top, left, width: CARD_WIDTH };
}

function TourTooltipCard({
  config,
  anchorRect,
  onDismiss,
  onAction,
}: {
  config: TooltipConfig;
  anchorRect: DOMRect;
  onDismiss: () => void;
  onAction?: () => void;
}) {
  const layout = computeCardLayout(anchorRect, config.placement);
  const cardRect = new DOMRect(layout.left, layout.top, layout.width, 120);

  return (
    <>
      <PointerArrow cardRect={cardRect} anchorRect={anchorRect} placement={config.placement} />
      <div
        className="fixed z-[200] border border-zinc-700/80 bg-[#0a0a0a] p-4 shadow-2xl"
        style={{ top: layout.top, left: layout.left, width: layout.width }}
        role="dialog"
        aria-labelledby={`tour-title-${config.id}`}
      >
        <div className="mb-2 flex items-center gap-2 text-[#FF8A3D]">
          {config.id === "morning_brief" ? (
            <Sunrise className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <p id={`tour-title-${config.id}`} className="text-xs font-semibold uppercase tracking-wide">
            {config.title}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-zinc-300">{config.body}</p>
        <div className="mt-4 flex items-center gap-3">
          {config.actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1 border border-[#FF8A3D]/40 bg-[#FF8A3D]/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#FF8A3D]/20"
            >
              {config.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-[#FF8A3D]"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}

export function InboxTooltips() {
  const pathname = usePathname();
  const { setAiSidebarOpen, setPendingAiQuery } = useAppState();
  const [dismissed, setDismissed] = useState<Set<InboxTooltipId>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<InboxTooltipId | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [highlightEl, setHighlightEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/inbox")) {
      setActiveId(null);
      return;
    }

    void fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.shown_tooltips) return;
        const shown = new Set(data.shown_tooltips as InboxTooltipId[]);
        setDismissed(shown);
        const next = TOOLTIPS.find((t) => {
          if (shown.has(t.id)) return false;
          if (t.desktopOnly && window.innerWidth < 1024) return false;
          return true;
        });
        setActiveId(next?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [pathname]);

  const measureAnchor = useCallback(() => {
    if (!activeId) return;
    const config = TOOLTIPS.find((t) => t.id === activeId);
    if (!config) return;

    if (config.id === "ai_sidebar") {
      setAiSidebarOpen(true);
    }

    const el = findTourAnchor(config.tourKey);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      setAnchorRect(el.getBoundingClientRect());
      setHighlightEl(el);
    } else {
      setAnchorRect(null);
      setHighlightEl(null);
    }
  }, [activeId, setAiSidebarOpen]);

  useEffect(() => {
    if (!activeId || dismissed.has(activeId)) return;

    const t0 = setTimeout(measureAnchor, 80);
    window.addEventListener("resize", measureAnchor);
    window.addEventListener("scroll", measureAnchor, true);
    const interval = setInterval(measureAnchor, 400);

    return () => {
      clearTimeout(t0);
      window.removeEventListener("resize", measureAnchor);
      window.removeEventListener("scroll", measureAnchor, true);
      clearInterval(interval);
    };
  }, [activeId, dismissed, measureAnchor]);

  useEffect(() => {
    if (!highlightEl) return;
    highlightEl.classList.add("dirac-tour-anchor");
    return () => highlightEl.classList.remove("dirac-tour-anchor");
  }, [highlightEl]);

  async function handleDismiss(id: InboxTooltipId) {
    const nextDismissed = new Set([...dismissed, id]);
    setDismissed(nextDismissed);
    setActiveId(null);
    setAnchorRect(null);
    setHighlightEl(null);

    try {
      await fetch("/api/user/tooltips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tooltip_id: id }),
      });
      const next = TOOLTIPS.find((t) => {
        if (nextDismissed.has(t.id)) return false;
        if (t.desktopOnly && window.innerWidth < 1024) return false;
        return true;
      });
      if (next) {
        setTimeout(() => setActiveId(next.id), 350);
      }
    } catch (err) {
      console.error("[inbox-tooltips] dismiss:", err);
    }
  }

  if (!mounted || !loaded || !pathname.startsWith("/inbox") || !activeId || dismissed.has(activeId)) {
    return null;
  }

  const config = TOOLTIPS.find((t) => t.id === activeId);
  if (!config || !anchorRect) return null;

  const runAction = () => {
    config.onAction?.({ setAiSidebarOpen, setPendingAiQuery });
  };

  return createPortal(
    <>
      <SpotlightCutout rect={anchorRect} />
      <TourTooltipCard
        config={config}
        anchorRect={anchorRect}
        onDismiss={() => handleDismiss(activeId)}
        onAction={config.actionLabel ? runAction : undefined}
      />
    </>,
    document.body,
  );
}
