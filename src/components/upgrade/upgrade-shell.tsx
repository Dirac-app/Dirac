"use client";

import type { ReactNode } from "react";

/** Matches signup premium dark shell. */
export function UpgradeShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      <div id="bg-effect" className="pointer-events-none fixed inset-0 z-0" aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-8 pt-8">
          <span className="text-sm font-semibold tracking-[0.2em] text-white uppercase">
            Dirac
          </span>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
