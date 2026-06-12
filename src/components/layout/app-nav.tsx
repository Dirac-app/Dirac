"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const NAV_LINKS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/paper-trail", label: "Paper trail", icon: FileText },
  { href: "/senders", label: "Senders", icon: Users },
  { href: "/clips", label: "Clip library", icon: Bookmark },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;


export function AppNav() {
  const pathname = usePathname();
  const { setComposeOpen, setComposeMinimized, unreadCount } = useAppState();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [briefMinimized, setBriefMinimized] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      setBriefMinimized((e as CustomEvent<{ minimized: boolean }>).detail.minimized);
    };
    window.addEventListener("dirac:morning-brief-minimized", handler);
    return () => window.removeEventListener("dirac:morning-brief-minimized", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
                onClick={() => window.dispatchEvent(new CustomEvent(
                  briefMinimized ? "dirac:reopen-morning-briefing" : "dirac:open-morning-briefing"
                ))}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center text-[#FF8A3D] transition-colors hover:bg-[#FF8A3D]/10 touch-target",
                  briefMinimized && "rounded-lg ring-2 ring-[#FF8A3D]/40",
                )}
              >
                <Sunrise className="h-4 w-4" strokeWidth={1.75} />
                {briefMinimized && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF8A3D] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF8A3D]" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {briefMinimized ? "Resume Morning Brief" : "Morning briefing"}
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
        <div className="relative flex items-center" ref={navRef}>
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
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setNavOpen(false)}
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
                  </Link>
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
            onClick={() => window.dispatchEvent(new CustomEvent(
              briefMinimized ? "dirac:reopen-morning-briefing" : "dirac:open-morning-briefing"
            ))}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center text-[#FF8A3D] touch-target rounded-lg",
              briefMinimized && "ring-2 ring-[#FF8A3D]/40",
            )}
            aria-label={briefMinimized ? "Resume Morning Brief" : "Morning Brief"}
          >
            <Sunrise className="h-4 w-4" strokeWidth={1.75} />
            {briefMinimized && (
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
