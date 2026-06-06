"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { UpgradeShell } from "@/components/upgrade/upgrade-shell";

type Decision = "continuing" | "not_continuing" | "undecided" | null;

const DECISION_OPTIONS: { value: Exclude<Decision, null>; label: string }[] = [
  { value: "continuing", label: "I'm planning to subscribe" },
  { value: "not_continuing", label: "I'm not continuing" },
  { value: "undecided", label: "Still deciding" },
];

export default function TrialFeedbackPage() {
  const router = useRouter();
  const [reminderKey, setReminderKey] = useState<string | undefined>();
  const [authReady, setAuthReady] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const reminder = p.get("reminder") ?? undefined;
    setReminderKey(reminder);

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const next = reminder
          ? `/trial-feedback?reminder=${encodeURIComponent(reminder)}`
          : "/trial-feedback";
        router.replace(`/signup?next=${encodeURIComponent(next)}`);
      } else {
        setAuthReady(true);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision || message.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/trial-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          message: message.trim(),
          reminder_key: reminderKey,
          source: reminderKey ? "trial_email" : "web",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
    } catch {
      setError("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady) {
    return (
      <UpgradeShell>
        <p className="text-center text-sm text-zinc-500">Loading…</p>
      </UpgradeShell>
    );
  }

  if (done) {
    return (
      <UpgradeShell>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          Thank you — this helps.
        </h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">
          Your note goes straight to the team building Dirac. We read every one.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/upgrade")}
            className="w-full bg-white px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            View plans
          </button>
          <button
            type="button"
            onClick={() => router.push("/inbox")}
            className="w-full border border-zinc-700 px-4 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
          >
            Back to inbox
          </button>
        </div>
      </UpgradeShell>
    );
  }

  return (
    <UpgradeShell>
      <p className="text-xs font-medium tracking-[0.15em] text-[#FF8A3D] uppercase">
        Your voice matters
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Help us make Dirac better.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Whether you&apos;re staying or stepping away, a quick note is genuinely valuable — it
        shapes what we build next. Takes under a minute.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <p className="mb-3 text-sm text-zinc-400">Where are you leaning?</p>
          <div className="space-y-2">
            {DECISION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDecision(opt.value)}
                className={`w-full border px-3 py-2.5 text-left text-sm transition-colors ${
                  decision === opt.value
                    ? "border-[#FF8A3D] bg-[#FF8A3D]/10 text-white"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="feedback-message" className="mb-2 block text-sm text-zinc-400">
            What influenced your decision?
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Price, features, timing, something missing — anything honest helps."
            className="w-full resize-none border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#FF8A3D] focus:outline-none focus:ring-1 focus:ring-[#FF8A3D]/40"
          />
        </div>

        <button
          type="submit"
          disabled={!decision || message.trim().length < 3 || submitting}
          className="w-full border border-[#FF8A3D] bg-[#FF8A3D]/10 px-4 py-3.5 text-sm font-medium text-white transition-opacity disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
        >
          {submitting ? "Sending…" : "Send feedback"}
        </button>

        {error && <p className="text-center text-sm text-[#FF8A3D]">{error}</p>}
      </form>
    </UpgradeShell>
  );
}
