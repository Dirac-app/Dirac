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

  const statsHtml =
    emails > 0 || drafts > 0
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d8;">
          So far you&rsquo;ve sent <strong style="color:#fafafa;">${emails}</strong> email${emails === 1 ? "" : "s"} through Dirac and drafted <strong style="color:#fafafa;">${drafts}</strong> AI repl${drafts === 1 ? "y" : "ies"}.
        </p>`
      : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d8;">
          You&rsquo;ve started triaging with Dirac &mdash; your inbox setup is in place.
        </p>`;

  let headline: string;
  let opener: string;
  if (key === "day_12") {
    headline = "2 days left on your trial";
    opener = `Your trial runs through <strong style="color:#fafafa;">${endDateLabel}</strong>.`;
  } else if (key === "day_14") {
    headline = "Last day of your trial";
    opener = `Access ends after <strong style="color:#fafafa;">${endDateLabel}</strong>.`;
  } else {
    headline = "Your trial has ended";
    opener = `Your access ended on <strong style="color:#fafafa;">${endDateLabel}</strong>.`;
  }

  const closing = `Losing this on ${endDateLabel}. $20/mo to keep it.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Dirac</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050505;background-image:linear-gradient(rgba(255,138,61,0.07) 1px, transparent 1px),linear-gradient(90deg, rgba(255,138,61,0.07) 1px, transparent 1px);background-size:28px 28px;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 0 20px;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#FF8A3D;">Dirac</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0a0a0a;border:1px solid #27272a;padding:32px 28px;">
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#a1a1aa;">Hi ${name},</p>
              <h1 style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.3;color:#fafafa;">${headline}</h1>
              <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#d4d4d8;">${opener}</p>
              ${statsHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;">
                <tr>
                  <td style="border-left:2px solid #FF8A3D;padding:12px 0 12px 16px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#fafafa;font-weight:500;">${closing}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
                <tr>
                  <td style="background-color:#fafafa;border-radius:2px;">
                    <a href="${upgradeUrl}" style="display:inline-block;padding:12px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#0a0a0a;text-decoration:none;">Keep Dirac &mdash; $20/mo</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border:1px solid rgba(255,138,61,0.45);border-radius:2px;">
                    <a href="${feedbackUrl}" style="display:inline-block;padding:11px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#FF8A3D;text-decoration:none;">Share quick feedback</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#71717a;">Whether you stay or not, a short note helps us improve Dirac &mdash; we read every one.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#52525b;text-align:center;">
              Dirac &middot; Your intelligent inbox
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const openerText = opener.replace(/<[^>]+>/g, "");
  const statsText =
    emails > 0 || drafts > 0
      ? `So far you've sent ${emails} email${emails === 1 ? "" : "s"} through Dirac and drafted ${drafts} AI repl${drafts === 1 ? "y" : "ies"}.`
      : `You've started triaging with Dirac — your inbox setup is in place.`;

  const text = `Hi ${name},

${headline}
${openerText}

${statsText}

${closing}

Keep Dirac: ${upgradeUrl}

Share feedback (helps us improve, super appreciated!): ${feedbackUrl}

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
    const feedbackUrl = `${appUrl}/trial-feedback?reminder=${key}`;
    const subject = buildSubject(key, endLabel);
    const { html, text } = buildBody(row, key, upgradeUrl, feedbackUrl, endLabel);

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
