"use client";

import * as React from "react";
import { Check, Moon, Sun, Monitor, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColorScheme, Density } from "@/lib/theme";

interface ThemeSelectorProps {
  colorScheme: ColorScheme;
  density: Density;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onDensityChange: (density: Density) => void;
}

const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string; description: string; colors: string[] }[] = [
  {
    value: "default",
    label: "Default",
    description: "Clean & classic",
    colors: ["#6366f1", "#f43f5e", "#22c55e"],
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Deep purple & indigo",
    colors: ["#6366f1", "#8b5cf6", "#a78bfa"],
  },
  {
    value: "forest",
    label: "Forest",
    description: "Earthy greens",
    colors: ["#22c55e", "#10b981", "#14b8a6"],
  },
  {
    value: "sunset",
    label: "Sunset",
    description: "Warm oranges",
    colors: ["#fb923c", "#f97316", "#ea580c"],
  },
  {
    value: "ocean",
    label: "Ocean",
    description: "Cool blues",
    colors: ["#3b82f6", "#06b6d4", "#0ea5e9"],
  },
];

const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "More content, less space" },
  { value: "comfortable", label: "Comfortable", description: "Balanced spacing" },
  { value: "spacious", label: "Spacious", description: "More breathing room" },
];

export function ThemeSelector({ colorScheme, density, onColorSchemeChange, onDensityChange }: ThemeSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Color Scheme</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COLOR_SCHEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onColorSchemeChange(option.value)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                colorScheme === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              )}
            >
              <div className="flex gap-1">
                {option.colors.map((color, i) => (
                  <div
                    key={i}
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium">{option.label}</span>
              {colorScheme === option.value && (
                <Check className="absolute top-2 right-2 h-3 w-3 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Display Density</span>
        </div>
        <div className="flex flex-col gap-2">
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDensityChange(option.value)}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all",
                density === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              )}
            >
              <div className="text-left">
                <span className="text-sm font-medium">{option.label}</span>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              {density === option.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ThemeToggleProps {
  colorScheme: ColorScheme;
  onChange: (scheme: ColorScheme) => void;
  className?: string;
}

export function ThemeToggle({ colorScheme, onChange, className }: ThemeToggleProps) {
  const cycles = ["default", "midnight", "forest", "sunset", "ocean"] as const;
  const currentIndex = cycles.indexOf(colorScheme);
  
  const cycle = () => {
    const nextIndex = (currentIndex + 1) % cycles.length;
    onChange(cycles[nextIndex]);
  };

  const labels: Record<ColorScheme, string> = {
    default: "Default",
    midnight: "Midnight",
    forest: "Forest",
    sunset: "Sunset",
    ocean: "Ocean",
  };

  return (
    <button
      onClick={cycle}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        "transition-colors",
        className
      )}
      title={`Theme: ${labels[colorScheme]}`}
    >
      <Palette className="h-3 w-3" />
      {labels[colorScheme]}
    </button>
  );
}