"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import type { ColorScheme, Density } from "@/lib/theme";

// A unified "app theme" bundles color scheme + dark/light together so the user
// only ever picks from a curated list and never touches a separate toggle.
export type AppTheme = "default-light" | "default-dark" | "win95-light" | "win95-dark" | "dark-email" | "light-email";

const APP_THEMES: {
  id: AppTheme;
  label: string;
  description: string;
  colorScheme: ColorScheme;
  mode: "light" | "dark";
  hidden?: boolean; // hidden from UI but kept for backwards-compat
  preview: { bg: string; panel: string; text: string; accent: string };
}[] = [
  // ── Hidden legacy themes (preserved in code, not shown in UI) ──
  {
    id: "default-light",
    label: "Default Light",
    description: "Clean & classic",
    colorScheme: "default",
    mode: "light",
    hidden: true,
    preview: { bg: "#f5f0eb", panel: "#ffffff", text: "#1a1a2e", accent: "#6366f1" },
  },
  {
    id: "default-dark",
    label: "Default Dark",
    description: "Clean & classic",
    colorScheme: "default",
    mode: "dark",
    hidden: true,
    preview: { bg: "#1a1a1e", panel: "#000000", text: "#f8f8fa", accent: "#a5b4fc" },
  },
  {
    id: "win95-light",
    label: "Windows 95",
    description: "Retro light",
    colorScheme: "retro95",
    mode: "light",
    hidden: true,
    preview: { bg: "#008080", panel: "#c0c0c0", text: "#000000", accent: "#000080" },
  },
  {
    id: "win95-dark",
    label: "Windows 95",
    description: "Retro dark",
    colorScheme: "retro95",
    mode: "dark",
    hidden: true,
    preview: { bg: "#000080", panel: "#1c1c1c", text: "#c0c0c0", accent: "#c0c0c0" },
  },
  // ── Active themes ──
  {
    id: "dark-email",
    label: "Dark",
    description: "Precise & technical",
    colorScheme: "dark-email",
    mode: "dark",
    preview: { bg: "#000000", panel: "#0d0d0d", text: "#ffffff", accent: "#f97316" },
  },
  {
    id: "light-email",
    label: "Light",
    description: "Spacious & warm",
    colorScheme: "light-email",
    mode: "light",
    preview: { bg: "#f0eef9", panel: "#ffffff", text: "#1a1a1a", accent: "#f97316" },
  },
];

interface ThemeSelectorProps {
  colorScheme: ColorScheme;
  density: Density;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onDensityChange: (density: Density) => void;
}

const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "More content, less space" },
  { value: "comfortable", label: "Comfortable", description: "Balanced spacing" },
  { value: "spacious", label: "Spacious", description: "More breathing room" },
];

export function ThemeSelector({ colorScheme, density, onColorSchemeChange, onDensityChange }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  const activeAppTheme: AppTheme =
    colorScheme === "dark-email"
      ? "dark-email"
      : colorScheme === "light-email"
      ? "light-email"
      : colorScheme === "retro95"
      ? theme === "dark" ? "win95-dark" : "win95-light"
      : theme === "dark" ? "default-dark" : "default-light";

  const handleAppThemeChange = (appTheme: AppTheme) => {
    const t = APP_THEMES.find(a => a.id === appTheme)!;
    onColorSchemeChange(t.colorScheme);
    setTheme(t.mode);
  };

  const visibleThemes = APP_THEMES.filter(t => !t.hidden);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm font-medium mb-3 block">Theme</span>
        <div className="grid grid-cols-2 gap-2">
          {visibleThemes.map((t) => {
            const isActive = activeAppTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleAppThemeChange(t.id)}
                className={cn(
                  "relative flex flex-col gap-2 p-3 rounded-lg border transition-all text-left",
                  isActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                )}
              >
                {/* Mini preview */}
                <div
                  className="w-full h-10 rounded overflow-hidden flex items-end gap-1 p-1"
                  style={{ background: t.preview.bg }}
                >
                  <div className="flex-1 h-6 rounded-sm flex flex-col justify-end overflow-hidden"
                    style={{ background: t.preview.panel }}
                  >
                    <div className="h-[2px] w-full opacity-80" style={{ background: t.preview.accent }} />
                  </div>
                  <div
                    className="w-2 h-full rounded-sm opacity-70"
                    style={{ background: t.preview.accent }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{t.description}</p>
                </div>
                {isActive && (
                  <Check className="absolute top-2 right-2 h-3 w-3 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="text-sm font-medium mb-3 block">Density</span>
        <div className="flex flex-col gap-2">
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDensityChange(option.value)}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all",
                density === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              )}
            >
              <div className="text-left">
                <span className="text-sm font-medium">{option.label}</span>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              {density === option.value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
