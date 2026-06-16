"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { UpgradeShell } from "@/components/upgrade/upgrade-shell";

export default function UpgradePage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/signup");
      } else {
        setAuthReady(true);
      }
    });
  }, [router]);

  async function startCheckout(plan: "monthly" | "annual") {
    setLoadingPlan(plan);
    try {
      const res = await fetch(`/api/stripe/checkout?plan=${plan}`, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      console.error("[upgrade] checkout:", data.error ?? res.statusText);
    } finally {
      setLoadingPlan(null);
    }
  }

  if (!authReady) {
    return (
      <UpgradeShell>
        <p className="text-center text-sm text-zinc-500">Loading…</p>
      </UpgradeShell>
    );
  }

  return (
    <UpgradeShell>
      <h1 className="text-center text-3xl font-semibold tracking-tight text-white">
        Your trial has ended.
      </h1>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          disabled={loadingPlan !== null}
          onClick={() => startCheckout("monthly")}
          className="w-full bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loadingPlan === "monthly" ? "Redirecting…" : "$20 / month"}
        </button>
        <button
          type="button"
          disabled={loadingPlan !== null}
          onClick={() => startCheckout("annual")}
          className="w-full border border-[#FF8A3D] bg-[#FF8A3D]/10 px-4 py-3.5 text-sm font-medium text-white transition-opacity hover:bg-[#FF8A3D]/20 disabled:opacity-50"
        >
          {loadingPlan === "annual" ? "Redirecting…" : "$200 / year"}
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link
          href="/trial-feedback"
          className="text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition-colors hover:text-[#FF8A3D] hover:decoration-[#FF8A3D]/50"
        >
          Share feedback — it genuinely helps us improve Dirac
        </Link>
      </p>
    </UpgradeShell>
  );
}
