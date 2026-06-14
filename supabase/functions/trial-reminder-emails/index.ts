import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TRIAL_DAYS = 7;
const REMINDER_KEYS = ["day_4", "day_6"] as const;
type ReminderKey = (typeof REMINDER_KEYS)[number];

const REMINDER_DAY_OFFSET: Record<ReminderKey, number> = {
  day_4: 4,
  day_6: 6,
};

interface TrialUser {
  id: string;
  email: string;
  name: string | null;
  trial_start_date: string;
  trial_reminders_sent: string[];
  subscription_status: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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
  return new Date(`${dateOnly}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTrialExpiredByTimestamp(trialStart: string): boolean {
  const start = new Date(trialStart).getTime();
  const cutoff = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > cutoff;
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

function firstName(user: TrialUser): string {
  const fromName = user.name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = user.email.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const F = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const ORANGE = `#FF8A3D`;

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

          <tr>
            <td style="padding:0 0 18px;">
              <span style="font-family:${F};font-size:13px;font-weight:700;letter-spacing:0.06em;color:${ORANGE};">DIRAC</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;padding:32px 32px 28px;">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0 0;font-family:${F};font-size:11px;color:#a1a1aa;text-align:center;line-height:1.6;">
              Dirac &middot; Your intelligent inbox &middot;
              <a href="${`{APP_URL}`}/settings" style="color:#a1a1aa;text-decoration:underline;text-underline-offset:2px;">Manage subscription</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Email builders ────────────────────────────────────────────────────────────

function buildDay4Email(
  user: TrialUser,
  inboxUrl: string,
  chargeDate: string,
): { subject: string; html: string; text: string } {
  const name = firstName(user);

  const tips = [
    {
      n: "1",
      label: "Morning Brief",
      detail: "Tap the sunrise icon each morning. It summarises what needs you, what can wait, and gives you a clear plan.",
    },
    {
      n: "2",
      label: "AI drafts",
      detail: "Open a thread → Reply → tap the sparkle icon. Dirac writes the first draft in your tone — edit and send.",
    },
    {
      n: "3",
      label: "Snooze",
      detail: "Right-click (or hold on mobile) any thread to snooze it. It reappears at exactly the right time.",
    },
  ];

  const tipsHtml = tips
    .map(
      (t) => `
      <tr>
        <td style="padding:0 0 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:1px;">
                <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background-color:#fff7ed;border:1px solid #fed7aa;font-family:${F};font-size:11px;font-weight:700;color:${ORANGE};text-align:center;line-height:20px;">${t.n}</span>
              </td>
              <td style="vertical-align:top;padding-left:10px;">
                <p style="margin:0 0 2px;font-family:${F};font-size:14px;font-weight:600;color:#111111;">${t.label}</p>
                <p style="margin:0;font-family:${F};font-size:13px;line-height:1.55;color:#71717a;">${t.detail}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  const htmlBody = `
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${name},</p>

    <h1 style="margin:0 0 8px;font-family:${F};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;color:#111111;">A few things worth knowing.</h1>
    <p style="margin:0 0 28px;font-family:${F};font-size:15px;line-height:1.6;color:#3f3f46;">
      You&rsquo;re 4 days in. Here are the features that save the most time.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      ${tipsHtml}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td style="height:1px;background-color:#f4f4f5;"></td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${ORANGE};border-radius:5px;">
          <a href="${inboxUrl}" style="display:inline-block;padding:12px 24px;font-family:${F};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open Dirac &rarr;</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-family:${F};font-size:13px;line-height:1.55;color:#a1a1aa;">
      Your trial ends on <strong style="color:#3f3f46;">${chargeDate}</strong>. Your card won&rsquo;t be charged until then.
    </p>

    <p style="margin:0;font-family:${F};font-size:14px;color:#3f3f46;">&mdash; Peter</p>`;

  const html = emailShell(htmlBody);

  const text = `Hi ${name},

A few things worth knowing.

You're 4 days in. Here are the features that save the most time.

1. Morning Brief
   Tap the sunrise icon each morning. It summarises what needs you, what can wait, and gives you a clear plan.

2. AI drafts
   Open a thread → Reply → tap the sparkle icon. Dirac writes the first draft in your tone — edit and send.

3. Snooze
   Right-click (or hold on mobile) any thread to snooze it. It reappears at exactly the right time.

Open Dirac: ${inboxUrl}

Your trial ends on ${chargeDate}. Your card won't be charged until then.

— Peter`;

  return { subject: "4 days in — a few things worth knowing", html, text };
}

function buildDay6Email(
  user: TrialUser,
  inboxUrl: string,
  settingsUrl: string,
  chargeDate: string,
  chargeDateLong: string,
): { subject: string; html: string; text: string } {
  const name = firstName(user);

  const htmlBody = `
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${name},</p>

    <h1 style="margin:0 0 8px;font-family:${F};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;color:#111111;">Your trial ends tomorrow.</h1>
    <p style="margin:0 0 24px;font-family:${F};font-size:15px;line-height:1.6;color:#3f3f46;">
      If you&rsquo;re happy with Dirac, there&rsquo;s nothing to do &mdash; your card on file will be charged on <strong>${chargeDateLong}</strong> and access continues seamlessly.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:5px;padding:14px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:14px;vertical-align:top;padding-top:2px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${ORANGE};margin-top:4px;"></span>
              </td>
              <td style="vertical-align:top;padding-left:10px;">
                <p style="margin:0 0 4px;font-family:${F};font-size:13px;font-weight:600;color:#111111;">Charging tomorrow &mdash; ${chargeDateLong}</p>
                <p style="margin:0;font-family:${F};font-size:13px;line-height:1.5;color:#71717a;">
                  Want to cancel? Go to <a href="${settingsUrl}" style="color:${ORANGE};text-decoration:none;font-weight:500;">Settings &rarr; Billing</a> before midnight, or just reply to this email and I&rsquo;ll handle it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${ORANGE};border-radius:5px;">
          <a href="${inboxUrl}" style="display:inline-block;padding:12px 24px;font-family:${F};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open Dirac &rarr;</a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-family:${F};font-size:14px;color:#3f3f46;">&mdash; Peter</p>`;

  const html = emailShell(htmlBody);

  const text = `Hi ${name},

Your trial ends tomorrow.

If you're happy with Dirac, there's nothing to do — your card on file will be charged on ${chargeDateLong} and access continues seamlessly.

Charging tomorrow — ${chargeDateLong}
Want to cancel? Go to Settings → Billing before midnight, or reply to this email and I'll handle it.

Open Dirac: ${inboxUrl}

— Peter`;

  return { subject: `Your Dirac trial ends tomorrow — ${chargeDate}`, html, text };
}

// ── Resend sender ─────────────────────────────────────────────────────────────

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

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("TRIAL_REMINDER_CRON_SECRET");
  const auth = req.headers.get("Authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Peter @ Dirac <peter@dirac.app>";
  const appUrl = (Deno.env.get("APP_URL") ?? "https://app.dirac.app").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Missing env configuration" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = todayUtc();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, name, trial_start_date, trial_reminders_sent, subscription_status")
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

  // Safety net: flip trialing → expired when Stripe hasn't done it yet
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

  // Send scheduled reminder emails
  for (const row of (users ?? []) as TrialUser[]) {
    const key = reminderKeyForUser(row, today);
    if (!key) continue;

    const endDateOnly = trialEndDateOnly(row.trial_start_date);
    const chargeDateLong = formatLongDate(endDateOnly);
    const inboxUrl = `${appUrl}/inbox`;
    const settingsUrl = `${appUrl}/settings`;

    let subject: string;
    let html: string;
    let text: string;

    if (key === "day_4") {
      ({ subject, html, text } = buildDay4Email(row, inboxUrl, chargeDateLong));
    } else {
      ({ subject, html, text } = buildDay6Email(
        row,
        inboxUrl,
        settingsUrl,
        endDateOnly,
        chargeDateLong,
      ));
    }

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

    results.push({
      userId: row.id,
      key,
      ok: !updateErr,
      error: updateErr?.message,
    });
  }

  return new Response(
    JSON.stringify({ date: today, processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
