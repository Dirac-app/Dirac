"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const BENEFITS = [
  "Unlimited Ai usage. Triage, bulk actions, and more.",
  "Morning Brief — what matters for the day.",
  "Draft replies in your voice, but 10x faster.",
] as const;

interface SignupPricingProps {
  /** Called when Stripe checkout redirects away (loading state). Caller can show a spinner. */
  onCheckoutRedirecting?: () => void;
}

export function SignupPricing({ onCheckoutRedirecting }: SignupPricingProps) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "monthly" | "annual") {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch(`/api/stripe/checkout?plan=${plan}&signup=true`, {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setLoading(null);
        return;
      }
      onCheckoutRedirecting?.();
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Start your free trial.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        7 days free. If it doesn't save you time, don't pay.
      </p>

      <ul className="mt-8 space-y-2.5">
        {BENEFITS.map((line, i) => (
          <motion.li
            key={line}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.3 }}
            className="flex gap-2.5 text-sm text-zinc-300"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF8A3D]" aria-hidden />
            {line}
          </motion.li>
        ))}
      </ul>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {/* Monthly */}
        <button
          type="button"
          onClick={() => void startCheckout("monthly")}
          disabled={loading !== null}
          className="border border-zinc-800 bg-zinc-950/50 px-4 py-5 text-left transition-colors hover:border-zinc-700 disabled:opacity-60"
        >
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Monthly</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">$20</p>
          <p className="text-xs text-zinc-500">per month</p>
          <p className="mt-3 text-xs font-medium text-zinc-400">
            {loading === "monthly" ? "Redirecting…" : "Start free trial →"}
          </p>
        </button>

        {/* Annual — recommended */}
        <button
          type="button"
          onClick={() => void startCheckout("annual")}
          disabled={loading !== null}
          className="border border-[#FF8A3D]/35 bg-[#FF8A3D]/5 px-4 py-5 text-left transition-colors hover:border-[#FF8A3D]/60 disabled:opacity-60"
        >
          <p className="text-xs font-medium tracking-wide text-[#FF8A3D] uppercase">Annual</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">$200</p>
          <p className="text-xs text-zinc-500">per year · save $40</p>
          <p className="mt-3 text-xs font-medium text-[#FF8A3D]">
            {loading === "annual" ? "Redirecting…" : "Start free trial →"}
          </p>
        </button>
      </div>

      <p className="mt-1 text-center text-[11px] text-zinc-600">
        Limited to first 100 founding users.
      </p>

      {error && <p className="mt-4 text-center text-sm text-[#FF8A3D]">{error}</p>}
    </div>
  );
}
