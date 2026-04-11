"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

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

const COLOR_SCHEMES: Record<ColorScheme, { light: string; dark: string }> = {
  default: {
    light: "",
    dark: "",
  },
  midnight: {
    light: "midnight",
    dark: "midnight",
  },
  forest: {
    light: "forest",
    dark: "forest",
  },
  sunset: {
    light: "sunset",
    dark: "sunset",
  },
  ocean: {
    light: "ocean",
    dark: "ocean",
  },
};

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

export function useThemeConfig() {
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

  return {
    config,
    setColorScheme,
    setDensity,
    colorSchemes: Object.keys(COLOR_SCHEMES) as ColorScheme[],
    densities: ["compact", "comfortable", "spacious"] as Density[],
  };
}

export function getColorSchemeClass(scheme: ColorScheme): string {
  if (scheme === "default") return "";
  return `theme-${scheme}`;
}

export function getDensityClass(density: Density): string {
  return `density-${density}`;
}

interface DiracThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function DiracThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "dirac-theme",
  ...props
}: DiracThemeProviderProps) {
  const [colorScheme, setColorScheme] = React.useState<ColorScheme>("default");
  const [density, setDensity] = React.useState<Density>("comfortable");

  React.useEffect(() => {
    const stored = getStoredConfig();
    if (stored) {
      setColorScheme(stored.colorScheme);
      setDensity(stored.density);
    }
  }, []);

  const colorSchemeClass = getColorSchemeClass(colorScheme);
  const densityClass = getDensityClass(density);

  return (
    <NextThemesProvider
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      attribute="class"
      enableSystem={true}
      {...props}
    >
      <div className={`${colorSchemeClass} ${densityClass}`}>
        {children}
      </div>
    </NextThemesProvider>
  );
}