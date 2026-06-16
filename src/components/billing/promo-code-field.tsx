"use client";

import { useState } from "react";
import {
  DEFAULT_ANNUAL_PROMO_CODE,
  DEFAULT_MONTHLY_PROMO_CODE,
} from "@/lib/stripe-promo-config";

interface PromoCodeFieldProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function PromoCodeField({ value, onChange, disabled }: PromoCodeFieldProps) {
  const [checking, setChecking] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  async function applyCode() {
    const code = value.trim();
    if (!code) {
      setAppliedSummary(null);
      setPromoError(null);
      return;
    }

    setChecking(true);
    setPromoError(null);
    setAppliedSummary(null);
    try {
      const res = await fetch(`/api/stripe/promo?code=${encodeURIComponent(code)}`);
      const data = (await res.json()) as {
        valid?: boolean;
        summary?: string;
        code?: string;
        error?: string;
      };
      if (!res.ok || !data.valid) {
        setPromoError(data.error ?? "Invalid or expired promo code");
        return;
      }
      if (data.code) onChange(data.code);
      setAppliedSummary(data.summary ?? "Discount applied");
    } catch {
      setPromoError("Could not validate promo code. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-6">
      <label htmlFor="promo-code" className="text-xs font-medium text-zinc-500">
        Promo code
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="promo-code"
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setAppliedSummary(null);
            setPromoError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void applyCode();
            }
          }}
          disabled={disabled || checking}
          placeholder="TRYDIRAC50 or TRYDIRAC25"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void applyCode()}
          disabled={disabled || checking || !value.trim()}
          className="shrink-0 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50"
        >
          {checking ? "…" : "Apply"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">
        Monthly: {DEFAULT_MONTHLY_PROMO_CODE} · Annual: {DEFAULT_ANNUAL_PROMO_CODE}
      </p>
      {appliedSummary && (
        <p className="mt-1.5 text-xs text-emerald-400">{appliedSummary} — applied at checkout</p>
      )}
      {promoError && <p className="mt-1.5 text-xs text-[#FF8A3D]">{promoError}</p>}
    </div>
  );
}
