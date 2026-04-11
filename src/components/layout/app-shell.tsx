"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemes } from "next-themes";
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
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { useThemeConfig, getColorSchemeClass, getDensityClass } from "@/lib/theme";
import { useEffect, useState } from "react";

function ThemedAppShell({ children }: { children: ReactNode }) {
  const { config } = useThemeConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="dirac-bg flex h-screen w-screen flex-col gap-2 md:gap-3 overflow-hidden p-2 md:p-4">
        <div className="flex-1" />
      </div>
    );
  }

  const colorSchemeClass = getColorSchemeClass(config.colorScheme);
  const densityClass = getDensityClass(config.density);

  return (
    <div className={`dirac-bg flex h-screen w-screen flex-col gap-2 md:gap-3 overflow-hidden p-2 md:p-4 ${colorSchemeClass} ${densityClass}`}>
      <AppNav />
      <main className="flex flex-1 items-stretch gap-2 md:gap-3 overflow-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={true}>
      <ToastProvider>
      <SessionProvider>
        <AppProvider>
          <KeyboardShortcutsProvider />
          <TooltipProvider delayDuration={0}>
            <ThemedAppShell>{children}</ThemedAppShell>
          </TooltipProvider>
          <SpotlightSearch />
          <ComposePanel />
          <MorningBriefing />
          <SetAsideBar />
          <ViewAllOverlay />
          <KeyboardShortcutsHelp />
          <OnboardingModal />
        </AppProvider>
      </SessionProvider>
      </ToastProvider>
    </NextThemes>
  );
}
