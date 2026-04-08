"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Inbox,
  Activity,
  Settings,
  Sparkles,
  Moon,
  Sun,
  Keyboard,
  Sunrise,
  Menu,
  PenSquare,
  FileText,
  Bookmark,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_LINKS = [
  { href: "/inbox",       label: "Inbox",       icon: Inbox },
  { href: "/paper-trail", label: "Paper trail",  icon: FileText },
  { href: "/clips",       label: "Clip library", icon: Bookmark },
  { href: "/activity",    label: "Activity",     icon: Activity },
  { href: "/settings",    label: "Settings",     icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { composeOpen, setComposeOpen, setComposeMinimized, unreadCount } = useAppState();
  const { theme, setTheme } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="dirac-panel flex h-12 items-center gap-2 px-3">
      {/* Nav trigger + slide-in drawer */}
      <div className="relative flex items-center" ref={navRef}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setNavOpen(v => !v)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
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

        {/* Slide-in nav panel */}
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+6px)] z-50 w-52 origin-top-left overflow-hidden rounded-xl border border-border bg-background shadow-xl transition-all duration-200",
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
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

      {/* Logo */}
      <div className="flex items-center gap-2 mr-auto">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">Dirac</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        {/* Morning briefing */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("dirac:open-morning-briefing"))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <Sunrise className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Morning briefing</TooltipContent>
        </Tooltip>

        {/* Keyboard shortcuts */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("dirac:shortcuts-help"))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <Keyboard className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Keyboard shortcuts (?)</TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <Sun  className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" strokeWidth={1.75} />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        <div className="mx-1.5 h-5 w-px bg-border" />

        {/* Compose */}
        <button
          onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PenSquare className="h-3.5 w-3.5" strokeWidth={2} />
          Compose
        </button>
      </div>
    </header>
  );
}
