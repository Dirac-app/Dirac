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
  if (key === "day_14") return `Last day of your Dirac trial`;
  return `Your Dirac trial ended`;
}

function buildBody(
  user: TrialUser,
  key: ReminderKey,
  upgradeUrl: string,
  endDateLabel: string,
): { html: string; text: string } {
  const name = firstName(user);
  const emails = user.emails_processed_count ?? 0;
  const drafts = user.ai_drafts_count ?? 0;

  const statsLine =
    emails > 0 || drafts > 0
      ? `So far you've sent <strong>${emails}</strong> email${emails === 1 ? "" : "s"} through Dirac and drafted <strong>${drafts}</strong> AI repl${drafts === 1 ? "y" : "ies"}.`
      : `You've started triaging with Dirac — your inbox setup is in place.`;

  let opener: string;
  if (key === "day_12") {
    opener = `Quick note — your trial runs through <strong>${endDateLabel}</strong> (2 days left).`;
  } else if (key === "day_14") {
    opener = `Today is the last day of your trial — access ends after <strong>${endDateLabel}</strong>.`;
  } else {
    opener = `Your trial ended on <strong>${endDateLabel}</strong>.`;
  }

  const closing = `Losing this on ${endDateLabel}. $20/mo to keep it.`;

  const html = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.55; color: #111;">
<p>Hi ${name},</p>
<p>${opener}</p>
<p>${statsLine}</p>
<p>${closing}</p>
<p style="margin-top: 24px;"><a href="${upgradeUrl}" style="color: #FF8A3D; font-weight: 600;">Keep Dirac →</a></p>
<p style="color: #666; font-size: 13px;">— Dirac</p>
</body></html>`;

  const text = `Hi ${name},

${opener.replace(/<[^>]+>/g, "")}

${statsLine.replace(/<[^>]+>/g, "")}

${closing}

Keep Dirac: ${upgradeUrl}

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

  const results: { userId: string; key: string; ok: boolean; error?: string }[] = [];

  for (const row of (users ?? []) as TrialUser[]) {
    const key = reminderKeyForUser(row, today);
    if (!key) continue;

    const endDate = trialEndDateOnly(row.trial_start_date);
    const endLabel = formatLongDate(endDate);
    const upgradeUrl = `${appUrl}/upgrade`;
    const subject = buildSubject(key, endLabel);
    const { html, text } = buildBody(row, key, upgradeUrl, endLabel);

    const sent = await sendResend(resendKey, fromEmail, row.email, subject, html, text);
    if (!sent.ok) {
      results.push({ userId: row.id, key, ok: false, error: sent.error });
      continue;
    }

    const nextSent = Array.from(new Set([...(row.trial_reminders_sent ?? []), key]));
    const { error: updateErr } = await supabase
      .from("users")
      .update({ trial_reminders_sent: nextSent })
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
