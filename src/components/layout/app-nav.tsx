"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Inbox,
  Activity,
  Settings,
  Keyboard,
  Sunrise,
  Menu,
  PenSquare,
  FileText,
  Bookmark,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getMorningStorageKey,
  loadMorningSettings,
} from "@/components/morning/morning-briefing";
import {
  loadPendingStore,
  MORNING_BRIEF_PENDING_CHANGED,
} from "@/lib/morning-brief-pending";

const NAV_LINKS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/paper-trail", label: "Paper trail", icon: FileText },
  { href: "/senders", label: "Senders", icon: Users },
  { href: "/clips", label: "Clip library", icon: Bookmark },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;


function computeHasUnseenBrief(): boolean {
  if (typeof window === "undefined") return false;
  const settings = loadMorningSettings();
  if (!settings.enabled) return false;
  const seen = window.localStorage.getItem(getMorningStorageKey());
  if (seen) return false;
  const pendingCount = loadPendingStore()?.cards.length ?? 0;
  return pendingCount > 0;
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setComposeOpen, setComposeMinimized, unreadCount } = useAppState();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const [hasUnseenBrief, setHasUnseenBrief] = useState(false);

  // Compute pulse on mount (client-only) and refresh on brief/pending events
  useEffect(() => {
    setHasUnseenBrief(computeHasUnseenBrief());

    const refresh = () => setHasUnseenBrief(computeHasUnseenBrief());
    // Cross-tab sync: the native storage event fires in all *other* tabs when
    // localStorage changes. This keeps the pulse in sync when /brief is opened
    // in a separate tab or window.
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key?.startsWith("dirac_morning_brief_seen_") ||
        e.key === "dirac_brief_pending"
      ) {
        setHasUnseenBrief(computeHasUnseenBrief());
      }
    };
    window.addEventListener(MORNING_BRIEF_PENDING_CHANGED, refresh);
    window.addEventListener("dirac:brief-seen", refresh);
    // Keep the old minimized listener so the modal's emit doesn't throw
    window.addEventListener("dirac:morning-brief-minimized", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(MORNING_BRIEF_PENDING_CHANGED, refresh);
      window.removeEventListener("dirac:brief-seen", refresh);
      window.removeEventListener("dirac:morning-brief-minimized", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Close on outside click/touch
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = "touches" in e ? e.touches[0]?.target : (e as MouseEvent).target;
      const insideDesktop = navRef.current?.contains(target as Node) ?? false;
      const insideMobile = mobileNavRef.current?.contains(target as Node) ?? false;
      if (!insideDesktop && !insideMobile) {
        setNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handler as EventListener);
    document.addEventListener("touchstart", handler as EventListener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler as EventListener);
      document.removeEventListener("touchstart", handler as EventListener);
    };
  }, [navOpen]);

  // Close on Escape
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navOpen]);

  // Compose button handler
  const handleCompose = () => {
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  // Render desktop nav (slide-in drawer)
  const renderDesktopNav = () => (
    <div className="relative flex items-center" ref={navRef}>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setNavOpen(v => !v)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors touch-target",
              navOpen
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Navigation</TooltipContent>
      </Tooltip>

      {/* Slide-in nav panel - desktop only */}
      <div
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-50 w-52 origin-top-left overflow-hidden rounded-xl border border-border bg-background shadow-xl transition-all duration-200 md:block hidden",
          navOpen
            ? "scale-100 opacity-100 translate-x-0"
            : "scale-95 opacity-0 -translate-x-2 pointer-events-none",
        )}
      >
        <div className="p-2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            const badge = href === "/inbox" && unreadCount > 0 ? unreadCount : null;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setNavOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-target",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {label}
                {badge !== null && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop header */}
      <header className="dirac-panel hidden md:flex h-12 items-center gap-2 px-3">
        {renderDesktopNav()}

        {/* Logo */}
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-sm font-semibold text-foreground tracking-tight">Dirac</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5">
          {/* Morning briefing */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                data-tour="morning-brief"
                onClick={() => window.open("/brief", "_blank")}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center text-[#FF8A3D] transition-colors hover:bg-[#FF8A3D]/10 touch-target",
                  pathname === "/brief" && "rounded-lg ring-2 ring-[#FF8A3D]/40",
                )}
              >
                <Sunrise className="h-4 w-4" strokeWidth={1.75} />
                {hasUnseenBrief && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF8A3D] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF8A3D]" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Morning briefing
            </TooltipContent>
          </Tooltip>

          {/* Keyboard shortcuts */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("dirac:shortcuts-help"))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground touch-target"
              >
                <Keyboard className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>Keyboard shortcuts (?)</TooltipContent>
          </Tooltip>

          <div className="mx-1.5 h-5 w-px bg-border" />

          {/* Compose */}
          <button
            onClick={handleCompose}
            className="compose-btn flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/50 touch-target"
          >
            <PenSquare className="h-3.5 w-3.5" strokeWidth={2} />
            Compose
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header className="dirac-panel flex md:hidden h-12 items-center gap-2 px-3 relative z-40">
        {/* Mobile hamburger → full-screen nav overlay */}
        <div className="relative flex items-center" ref={mobileNavRef}>
          <button
            onClick={() => setNavOpen(v => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors touch-target",
              navOpen ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            aria-label="Navigation"
          >
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Full-width slide-down nav panel — mobile only */}
          <div
            className={cn(
              "fixed left-0 right-0 top-12 z-50 border-b border-border bg-background shadow-xl transition-all duration-200 md:hidden",
              navOpen
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 -translate-y-2 pointer-events-none",
            )}
          >
            <nav className="p-3 grid grid-cols-3 gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                const badge = href === "/inbox" && unreadCount > 0 ? unreadCount : null;
                return (
                  <button
                    key={href}
                    onClick={() => { setNavOpen(false); router.push(href); }}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-medium transition-colors touch-target",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    {label}
                    {badge !== null && (
                      <span className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <span className="text-sm font-semibold text-foreground tracking-tight">Dirac</span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            data-tour="morning-brief"
            onClick={() => window.open("/brief", "_blank")}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center text-[#FF8A3D] touch-target rounded-lg",
              pathname === "/brief" && "ring-2 ring-[#FF8A3D]/40",
            )}
            aria-label="Morning Brief"
          >
            <Sunrise className="h-4 w-4" strokeWidth={1.75} />
            {hasUnseenBrief && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF8A3D] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF8A3D]" />
              </span>
            )}
          </button>
          <button
            onClick={handleCompose}
            className="compose-btn flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors touch-target"
          >
            <PenSquare className="h-3.5 w-3.5" strokeWidth={2} />
            Compose
          </button>
        </div>
      </header>
    </>
  );
}
