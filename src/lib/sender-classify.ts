/**
 * Sender classification utilities.
 *
 * Two-phase approach:
 *  1. `preclassifyEmail` — instant, rule-based. No API call. Catches obvious
 *     automated senders (no-reply, newsletters, CI, etc.) and team addresses.
 *  2. `classifyUnknownSenders` — AI-backed batch call for anything rules can't
 *     determine. Results are written straight to the sender-level cache.
 */

import type { FounderCategory } from "@/lib/types";
import {
  loadSenderAiCategories,
  saveSenderAiCategories,
  setSenderAiCategory,
} from "@/lib/sender-categories";

// ── Rule-based preclassification ──────────────────────────────────────────────

const AUTOMATED_EMAIL_PATTERNS = [
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply", "do_not_reply",
  "notifications@", "notification@", "alerts@", "alert@",
  "newsletter@", "newsletters@", "digest@", "mailer@", "mailer-daemon",
  "bounce@", "-bounces@", "bounces@", "postmaster@",
  "noreply@github", "noreply@gitlab", "noreply@vercel", "noreply@netlify",
  "noreply@heroku", "noreply@stripe", "noreply@paypal", "noreply@shopify",
  "sendgrid", "mailchimp", "mailgun", "mandrillapp", "postmarkapp",
  "amazonses", "amazonaws.com", "sparkpostmail",
  "updates@", "update@", "automated@",
  // Common platform notification domains
  "mail.instagram.com", "facebookmail.com", "twitteremail.com",
  "notify.railway.app", "em.notion.so", "mail.notion.so",
  "github.com", "gitlab.com",
];

const PUBLIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "aol.com", "zoho.com",
]);

/**
 * Rule-based classification by email alone. Returns null if rules can't decide.
 * `teamDomain` (e.g. "acme.com") marks matching senders as "team".
 */
export function preclassifyEmail(
  email: string,
  teamDomain?: string,
): FounderCategory | null {
  const addr = email.toLowerCase();

  if (teamDomain && !PUBLIC_DOMAINS.has(teamDomain) && addr.endsWith(`@${teamDomain}`)) {
    return "team";
  }

  if (AUTOMATED_EMAIL_PATTERNS.some((p) => addr.includes(p))) return "automated";

  return null;
}

// ── AI batch classification ───────────────────────────────────────────────────

const BATCH_SIZE = 40; // senders per AI call
const CLASSIFY_LOCK_KEY = "dirac:sender_classify_running";

/**
 * Classify all senders in `unknown` list using the AI categorize endpoint.
 * Each sender is sent as a minimal "thread" (email + name, no body).
 * Results are written to localStorage immediately as they arrive.
 *
 * Returns the number of senders newly classified.
 */
export async function classifyUnknownSenders(
  senders: { email: string; name: string }[],
  teamDomain?: string,
  onProgress?: (newCats: Record<string, FounderCategory>) => void,
): Promise<number> {
  if (senders.length === 0) return 0;

  // Prevent concurrent calls (e.g. if the user navigates away and back)
  if (sessionStorage.getItem(CLASSIFY_LOCK_KEY) === "1") return 0;
  sessionStorage.setItem(CLASSIFY_LOCK_KEY, "1");

  try {
    let totalClassified = 0;

    for (let i = 0; i < senders.length; i += BATCH_SIZE) {
      const batch = senders.slice(i, i + BATCH_SIZE);

      // Phase 1 inside batch: rule-based (instant)
      const needsAi: typeof batch = [];
      for (const s of batch) {
        const pre = preclassifyEmail(s.email, teamDomain);
        if (pre) {
          setSenderAiCategory(s.email, pre);
          totalClassified++;
        } else {
          needsAi.push(s);
        }
      }

      // Notify after rule-based pass
      if (onProgress) onProgress(loadSenderAiCategories());

      if (needsAi.length === 0) continue;

      // Phase 2: AI for the remainder
      const summaries = needsAi.map((s) => ({
        threadId: s.email, // use email as ID — no real thread
        subject: "",
        snippet: "",
        from: s.email,
        fromName: s.name || s.email,
        messageCount: 1,
        participantCount: 1,
        isForward: false,
      }));

      const body = JSON.stringify({
        threads: summaries,
        teamDomain: teamDomain ?? "",
        existingTabs: [],
      });

      try {
        let res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        // If rate-limited, wait for the window to reset and retry once
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("Retry-After") ?? "10");
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          res = await fetch("/api/ai/categorize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
        }

        if (res.ok) {
          const data = await res.json();
          const cats = loadSenderAiCategories();
          for (const r of data.results ?? []) {
            if (r.threadId && r.category) {
              cats[r.threadId] = r.category; // threadId is the email
              totalClassified++;
            }
          }
          saveSenderAiCategories(cats);
          if (onProgress) onProgress(cats);
        }
      } catch {
        // Network failure — continue with next batch
      }
    }

    return totalClassified;
  } finally {
    sessionStorage.removeItem(CLASSIFY_LOCK_KEY);
  }
}
