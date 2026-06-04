"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import type { InboxTooltipId } from "@/lib/users-db";

interface TooltipConfig {
  id: InboxTooltipId;
  anchorId: string;
  body: string;
  placement: "top" | "left";
}

const TOOLTIPS: TooltipConfig[] = [
  {
    id: "morning_brief",
    anchorId: "tour-morning-brief",
    placement: "top",
    body: "Your first Morning Brief arrives with what matters, and a plan to deal with each one. Everything else has been sorted in the background.",
  },
  {
    id: "ai_sidebar",
    anchorId: "tour-ai-sidebar",
    placement: "left",
    body: "Ask Dirac anything. \"Reply to the Stripe email\" or \"Archive all newsletters\". It'll handle it.",
  },
];

function TooltipCard({
  body,
  anchorRect,
  placement,
  onDismiss,
}: {
  body: string;
  anchorRect: DOMRect;
  placement: "top" | "left";
  onDismiss: () => void;
}) {
  const width = 280;
  let top = anchorRect.bottom + 12;
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;

  if (placement === "left") {
    top = anchorRect.top + anchorRect.height / 2 - 60;
    left = anchorRect.left - width - 16;
  }

  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  top = Math.max(12, top);

  return (
    <div
      className="fixed z-[200] border border-zinc-800 bg-[#0a0a0a] p-4 shadow-xl"
      style={{ top, left, width }}
      role="dialog"
      aria-live="polite"
    >
      <p className="text-sm leading-relaxed text-zinc-300">{body}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 text-xs font-medium text-[#FF8A3D] hover:underline"
      >
        Got it
      </button>
    </div>
  );
}

export function InboxTooltips() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<Set<InboxTooltipId>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<InboxTooltipId | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

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
        const next = TOOLTIPS.find((t) => !shown.has(t.id));
        setActiveId(next?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [pathname]);

  const measureAnchor = useCallback(() => {
    if (!activeId) return;
    const config = TOOLTIPS.find((t) => t.id === activeId);
    if (!config) return;
    const el = document.getElementById(config.anchorId);
    if (el) setAnchorRect(el.getBoundingClientRect());
  }, [activeId]);

  useEffect(() => {
    if (!activeId || dismissed.has(activeId)) return;
    measureAnchor();
    window.addEventListener("resize", measureAnchor);
    window.addEventListener("scroll", measureAnchor, true);
    const t = setInterval(measureAnchor, 500);
    return () => {
      window.removeEventListener("resize", measureAnchor);
      window.removeEventListener("scroll", measureAnchor, true);
      clearInterval(t);
    };
  }, [activeId, dismissed, measureAnchor]);

  async function handleDismiss(id: InboxTooltipId) {
    setDismissed((prev) => new Set([...prev, id]));
    setActiveId(null);
    try {
      await fetch("/api/user/tooltips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tooltip_id: id }),
      });
      const next = TOOLTIPS.find((t) => t.id !== id && !dismissed.has(t.id));
      if (next && next.id !== id) {
        setTimeout(() => setActiveId(next.id), 300);
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

  return createPortal(
    <TooltipCard
      body={config.body}
      anchorRect={anchorRect}
      placement={config.placement}
      onDismiss={() => handleDismiss(activeId)}
    />,
    document.body,
  );
}
