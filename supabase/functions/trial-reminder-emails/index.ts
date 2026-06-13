import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TRIAL_DAYS = 14;
const REMINDER_KEYS = ["day_12", "day_14", "day_15"] as const;
type ReminderKey = (typeof REMINDER_KEYS)[number];

const REMINDER_DAY_OFFSET: Record<ReminderKey, number> = {
  day_12: 12,
  day_14: 14,
  day_15: 15,
};

interface TrialUser {
  id: string;
  email: string;
  name: string | null;
  trial_start_date: string;
  emails_processed_count: number;
  ai_drafts_count: number;
  trial_reminders_sent: string[];
  subscription_status: string;
}

function utcDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function trialEndDateOnly(trialStart: string): string {
  return addDays(utcDateOnly(trialStart), TRIAL_DAYS);
}

function formatLongDate(dateOnly: string): string {
  const d = new Date(`${dateOnly}T12:00:00.000Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function firstName(user: TrialUser): string {
  const fromName = user.name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = user.email.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function buildSubject(key: ReminderKey, endLabel: string): string {
  if (key === "day_12") return `2 days left on Dirac — ends ${endLabel}`;
  if (key === "day_14") return `Last day of your Dirac trial!`;
  return `Your Dirac trial ended`;
}

/** Shared inline styles for the email design system */
const F = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

/** Wraps content in a consistent light-mode email shell */
function emailShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dirac</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 18px;">
              <span style="font-family:${F};font-size:13px;font-weight:700;letter-spacing:0.06em;color:#FF8A3D;">DIRAC</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;padding:32px 32px 28px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;font-family:${F};font-size:11px;color:#a1a1aa;text-align:center;line-height:1.6;">
              Dirac &middot; Your intelligent inbox
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildBody(
  user: TrialUser,
  key: ReminderKey,
  upgradeUrl: string,
  feedbackUrl: string,
  endDateLabel: string,
): { html: string; text: string } {
  const name = firstName(user);
  const emails = user.emails_processed_count ?? 0;
  const drafts = user.ai_drafts_count ?? 0;

  // Stats line — shown inside the accent callout
  const statsText =
    emails > 0 || drafts > 0
      ? `You&rsquo;ve processed <strong>${emails}</strong> email${emails === 1 ? "" : "s"} and drafted <strong>${drafts}</strong> AI repl${drafts === 1 ? "y" : "ies"} through Dirac.`
      : `You&rsquo;ve started triaging with Dirac &mdash; your inbox setup is in place.`;

  const statsPlain =
    emails > 0 || drafts > 0
      ? `You've processed ${emails} email${emails === 1 ? "" : "s"} and drafted ${drafts} AI repl${drafts === 1 ? "y" : "ies"} through Dirac.`
      : `You've started triaging with Dirac — your inbox setup is in place.`;

  let headline: string;
  let openerHtml: string;
  let openerPlain: string;
  let ctaLabel: string;

  if (key === "day_12") {
    headline = "2 days left on your Dirac trial";
    openerHtml = `Quick note &mdash; your trial runs through <strong>${endDateLabel}</strong> (2 days left).`;
    openerPlain = `Quick note — your trial runs through ${endDateLabel} (2 days left).`;
    ctaLabel = "Keep Dirac &rarr; $20/mo";
  } else if (key === "day_14") {
    headline = "Today is your last day";
    openerHtml = `Your Dirac trial ends <strong>today, ${endDateLabel}</strong>.`;
    openerPlain = `Your Dirac trial ends today, ${endDateLabel}.`;
    ctaLabel = "Keep access &rarr; $20/mo";
  } else {
    headline = "Your trial has ended";
    openerHtml = `Your Dirac access ended on <strong>${endDateLabel}</strong>.`;
    openerPlain = `Your Dirac access ended on ${endDateLabel}.`;
    ctaLabel = "Reactivate Dirac &rarr;";
  }

  const htmlBody = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${name},</p>

    <!-- Headline -->
    <h1 style="margin:0 0 20px;font-family:${F};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;color:#111111;">${headline}</h1>

    <!-- Opener -->
    <p style="margin:0 0 20px;font-family:${F};font-size:15px;line-height:1.65;color:#3f3f46;">${openerHtml}</p>

    <!-- Stats callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#fff7ed;border-left:3px solid #FF8A3D;border-radius:0 4px 4px 0;padding:12px 16px;">
          <p style="margin:0;font-family:${F};font-size:14px;line-height:1.55;color:#3f3f46;">${statsText}</p>
        </td>
      </tr>
    </table>

    <!-- Closing line -->
    <p style="margin:0 0 24px;font-family:${F};font-size:14px;line-height:1.55;color:#3f3f46;">
      ${key === "day_15"
        ? `If you want to pick up where you left off, your inbox and history are still here.`
        : `Losing this on ${endDateLabel}. Upgrade to keep everything.`
      }
    </p>

    <!-- Primary CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
      <tr>
        <td style="background-color:#FF8A3D;border-radius:5px;">
          <a href="${upgradeUrl}" style="display:inline-block;padding:12px 24px;font-family:${F};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${ctaLabel}</a>
        </td>
      </tr>
    </table>

    <!-- Secondary CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td>
          <a href="${feedbackUrl}" style="font-family:${F};font-size:13px;color:#71717a;text-decoration:underline;text-underline-offset:2px;">Share quick feedback</a>
        </td>
      </tr>
    </table>

    <!-- Note -->
    <p style="margin:0;font-family:${F};font-size:12px;line-height:1.6;color:#a1a1aa;">
      Whether you stay or not, a quick note helps us improve Dirac &mdash; we read every one.
    </p>`;

  const html = emailShell(htmlBody);

  const text = `Hi ${name},

${headline}

${openerPlain}

${statsPlain}

${key === "day_15"
    ? `If you want to pick up where you left off, your inbox and history are still here.`
    : `Losing this on ${endDateLabel}. Upgrade to keep everything.`
  }

${ctaLabel.replace(/&rarr;|&mdash;/g, "→").replace(/&[a-z]+;/g, "")}: ${upgradeUrl}

Share feedback: ${feedbackUrl}

— Dirac`;

  return { html, text };
}

async function sendResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }
  return { ok: true };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function reminderKeyForUser(user: TrialUser, today: string): ReminderKey | null {
  if (!user.trial_start_date) return null;
  const start = utcDateOnly(user.trial_start_date);
  const sent = new Set(user.trial_reminders_sent ?? []);

  for (const key of REMINDER_KEYS) {
    const target = addDays(start, REMINDER_DAY_OFFSET[key]);
    if (target === today && !sent.has(key)) return key;
  }
  return null;
}

/** Matches app logic in src/lib/subscription.ts (14 × 24h after trial_start_date). */
function isTrialExpiredByTimestamp(trialStart: string): boolean {
  const start = new Date(trialStart).getTime();
  const cutoff = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > cutoff;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("TRIAL_REMINDER_CRON_SECRET");
  const auth = req.headers.get("Authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Dirac <billing@notifications.dirac.app>";
  const appUrl = (Deno.env.get("APP_URL") ?? "https://app.dirac.app").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Missing env configuration" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = todayUtc();

  const { data: users, error } = await supabase
    .from("users")
    .select(
      "id, email, name, trial_start_date, emails_processed_count, ai_drafts_count, trial_reminders_sent, subscription_status",
    )
    .not("trial_start_date", "is", null)
    .neq("subscription_status", "active");

  if (error) {
    console.error("[trial-reminder-emails]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: {
    userId: string;
    key?: string;
    action?: string;
    ok: boolean;
    error?: string;
  }[] = [];

  // Flip trialing → expired in DB when past 14 days (emails alone never did this).
  for (const row of (users ?? []) as TrialUser[]) {
    if (row.subscription_status !== "trialing" || !row.trial_start_date) continue;
    if (!isTrialExpiredByTimestamp(row.trial_start_date)) continue;

    const { error: expireErr } = await supabase
      .from("users")
      .update({ subscription_status: "expired" })
      .eq("id", row.id)
      .eq("subscription_status", "trialing");

    results.push({
      userId: row.id,
      action: "expire_trial",
      ok: !expireErr,
      error: expireErr?.message,
    });
    if (!expireErr) row.subscription_status = "expired";
  }

  for (const row of (users ?? []) as TrialUser[]) {
    const key = reminderKeyForUser(row, today);
    if (!key) continue;

    const endDate = trialEndDateOnly(row.trial_start_date);
    const endLabel = formatLongDate(endDate);
    const upgradeUrl = `${appUrl}/upgrade`;
    const feedbackUrl = `${appUrl}/trial-feedback?reminder=${key}`;
    const subject = buildSubject(key, endLabel);
    const { html, text } = buildBody(row, key, upgradeUrl, feedbackUrl, endLabel);

    const sent = await sendResend(resendKey, fromEmail, row.email, subject, html, text);
    if (!sent.ok) {
      results.push({ userId: row.id, key, ok: false, error: sent.error });
      continue;
    }

    const nextSent = Array.from(new Set([...(row.trial_reminders_sent ?? []), key]));
    const patch: { trial_reminders_sent: string[]; subscription_status?: string } = {
      trial_reminders_sent: nextSent,
    };
    if (key === "day_15" || isTrialExpiredByTimestamp(row.trial_start_date)) {
      patch.subscription_status = "expired";
    }
    const { error: updateErr } = await supabase
      .from("users")
      .update(patch)
      .eq("id", row.id);

    if (updateErr) {
      results.push({ userId: row.id, key, ok: false, error: updateErr.message });
    } else {
      results.push({ userId: row.id, key, ok: true });
    }
  }

  return new Response(
    JSON.stringify({ date: today, processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
