"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

export type ColorScheme = 
  | "default" 
  | "midnight" 
  | "forest" 
  | "sunset" 
  | "ocean";

export type Density = "compact" | "comfortable" | "spacious";

export interface ThemeConfig {
  colorScheme: ColorScheme;
  density: Density;
}

const STORAGE_KEY = "dirac-theme-config";

export function getStoredConfig(): ThemeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function storeConfig(config: ThemeConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

// Shared context so every consumer of useThemeConfig shares the same state
interface ThemeConfigContextValue {
  config: ThemeConfig;
  setColorScheme: (scheme: ColorScheme) => void;
  setDensity: (density: Density) => void;
  colorSchemes: ColorScheme[];
  densities: Density[];
}

const ThemeConfigContext = React.createContext<ThemeConfigContextValue | null>(null);

export function ThemeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<ThemeConfig>(() => {
    const stored = getStoredConfig();
    return stored ?? { colorScheme: "default", density: "comfortable" };
  });

  const setColorScheme = React.useCallback((colorScheme: ColorScheme) => {
    setConfig((prev) => {
      const next = { ...prev, colorScheme };
      storeConfig(next);
      return next;
    });
  }, []);

  const setDensity = React.useCallback((density: Density) => {
    setConfig((prev) => {
      const next = { ...prev, density };
      storeConfig(next);
      return next;
    });
  }, []);

  const value = React.useMemo<ThemeConfigContextValue>(() => ({
    config,
    setColorScheme,
    setDensity,
    colorSchemes: ["default", "midnight", "forest", "sunset", "ocean"],
    densities: ["compact", "comfortable", "spacious"],
  }), [config, setColorScheme, setDensity]);

  return (
    <ThemeConfigContext.Provider value={value}>
      {children}
    </ThemeConfigContext.Provider>
  );
}

export function useThemeConfig(): ThemeConfigContextValue {
  const ctx = React.useContext(ThemeConfigContext);
  if (!ctx) {
    throw new Error("useThemeConfig must be used within ThemeConfigProvider");
  }
  return ctx;
}

export function getColorSchemeClass(scheme: ColorScheme): string {
  if (scheme === "default") return "";
  return `theme-${scheme}`;
}

export function getDensityClass(density: Density): string {
  return `density-${density}`;
}