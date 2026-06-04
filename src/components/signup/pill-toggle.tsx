"use client";

import { cn } from "@/lib/utils";

interface PillToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}

export function PillToggle<T extends string>({ options, value, onChange }: PillToggleProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "border px-3 py-2 text-sm transition-colors",
              selected
                ? "border-[#FF8A3D] bg-[#FF8A3D]/10 text-white"
                : "border-zinc-800 bg-transparent text-zinc-300 hover:border-zinc-600",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
