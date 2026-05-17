"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemes } from "next-themes";
import { AppNav } from "./app-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./app-provider";
import { SessionProvider } from "./session-provider";
import { QueryProvider } from "./query-provider";
import { ComposePanel } from "@/components/compose/compose-panel";
import { SpotlightSearch } from "@/components/command-palette/spotlight-search";
import { KeyboardShortcutsProvider } from "./keyboard-shortcuts-provider";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts/keyboard-shortcuts-help";
import { ToastProvider } from "@/components/ui/toast";
import { MorningBriefing } from "@/components/morning/morning-briefing";
import { SetAsideBar } from "@/components/set-aside/set-aside-bar";
import { ViewAllOverlay } from "@/components/inbox/view-all-overlay";
import { OnboardingController } from "@/components/onboarding/onboarding-controller";
import { ThemeConfigProvider, useThemeConfig, getColorSchemeClass, getDensityClass } from "@/lib/theme";
import { useEffect, useState } from "react";
import { PenSquare } from "lucide-react";
import { useAppState } from "@/lib/store";

function ThemedAppShell({ children }: { children: ReactNode }) {
  const { config } = useThemeConfig();
  const { setComposeOpen, setComposeMinimized } = useAppState();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted) {
    return (
      <div className="dirac-bg flex h-screen w-screen flex-col overflow-hidden divide-y divide-border">
        <div className="flex-1" />
      </div>
    );
  }

  const colorSchemeClass = getColorSchemeClass(config.colorScheme);
  const densityClass = getDensityClass(config.density);

  const handleCompose = () => {
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  const isPanelLayout = config.colorScheme === "light-email";

  return (
    <div className={`dirac-bg flex h-screen w-screen flex-col overflow-hidden ${isPanelLayout ? 'gap-0' : 'divide-y divide-border'} ${colorSchemeClass} ${densityClass}`}>
      <AppNav />
      {/* Mobile: single column layout, Desktop: horizontal layout */}
      <main className={`flex flex-1 items-stretch overflow-hidden min-h-0 ${
          isPanelLayout
          ? isMobile ? 'flex-col gap-3 p-3' : 'gap-3 p-3'
          : isMobile ? 'flex-col divide-y divide-border' : 'divide-x divide-border'
      }`}>
        {children}
      </main>
      
      {/* Mobile FAB (Floating Action Button) for compose - shown on mobile only */}
      <button
        onClick={handleCompose}
        className="compose-fab md:hidden"
        aria-label="Compose new email"
      >
        <PenSquare className="h-6 w-6" strokeWidth={2} />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={true}>
      <ToastProvider>
      <SessionProvider>
        <QueryProvider>
          <ThemeConfigProvider>
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
            <OnboardingController />
          </AppProvider>
          </ThemeConfigProvider>
        </QueryProvider>
      </SessionProvider>
      </ToastProvider>
    </NextThemes>
  );
}
