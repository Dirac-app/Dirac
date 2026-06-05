"use client";

import { cn } from "@/lib/utils";

interface PillToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** When selected, show a text field (e.g. value `"other"`). */
  otherValue?: T;
  otherText?: string;
  onOtherTextChange?: (text: string) => void;
  otherPlaceholder?: string;
}

export function PillToggle<T extends string>({
  options,
  value,
  onChange,
  otherValue = "other" as T,
  otherText = "",
  onOtherTextChange,
  otherPlaceholder = "Tell us more…",
}: PillToggleProps<T>) {
  const showOtherField = value === otherValue && onOtherTextChange;

  return (
    <div className="space-y-3">
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
      {showOtherField && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => onOtherTextChange(e.target.value)}
          placeholder={otherPlaceholder}
          maxLength={200}
          autoFocus
          className="w-full border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#FF8A3D] focus:outline-none focus:ring-1 focus:ring-[#FF8A3D]/40"
        />
      )}
    </div>
  );
}
