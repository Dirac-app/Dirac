"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
      <main className="home-root">
        <div className="home-card appear d1">
          <p className="home-sub">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="home-root">
      <div className="home-card appear d1 max-w-md">
        <img src="/favicon.png" alt="Dirac" className="home-logo" />

        <h1 className="home-title">Upgrade Dirac</h1>
        <p className="home-sub">
          Your trial has ended. Choose a plan to keep using Dirac as your inbox chief of staff.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="home-btn w-full"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout("monthly")}
          >
            {loadingPlan === "monthly" ? "Redirecting…" : "Monthly — $20/mo"}
          </button>
          <button
            type="button"
            className="home-btn w-full border border-border bg-transparent text-foreground hover:bg-muted"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout("annual")}
          >
            {loadingPlan === "annual" ? "Redirecting…" : "Annual — $200/yr"}
          </button>
        </div>

        <p className="home-footer">
          Questions? <a href="mailto:team@dirac.app">Contact the Dirac team</a>
        </p>
      </div>
    </main>
  );
}
