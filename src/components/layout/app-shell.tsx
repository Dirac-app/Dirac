"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AppNav } from "./app-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./app-provider";
import { SessionProvider } from "./session-provider";
import { ComposePanel } from "@/components/compose/compose-panel";
import { SpotlightSearch } from "@/components/command-palette/spotlight-search";
import { KeyboardShortcutsProvider } from "./keyboard-shortcuts-provider";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts/keyboard-shortcuts-help";
import { ToastProvider } from "@/components/ui/toast";
import { MorningBriefing } from "@/components/morning/morning-briefing";
import { SetAsideBar } from "@/components/set-aside/set-aside-bar";
import { ViewAllOverlay } from "@/components/inbox/view-all-overlay";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ToastProvider>
      <SessionProvider>
        <AppProvider>
          <KeyboardShortcutsProvider />
          <TooltipProvider delayDuration={0}>
            <div className="dirac-bg flex h-screen w-screen flex-col gap-3 overflow-hidden p-4">
              <AppNav />
              <main className="flex flex-1 items-stretch gap-3 overflow-hidden min-h-0">
                {children}
              </main>
            </div>
          </TooltipProvider>
          <SpotlightSearch />
          <ComposePanel />
          <MorningBriefing />
          <SetAsideBar />
          <ViewAllOverlay />
          <KeyboardShortcutsHelp />
        </AppProvider>
      </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
