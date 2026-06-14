/**
 * Shared email utilities for Dirac transactional emails.
 * Uses Resend to deliver. All templates are light-mode HTML for
 * consistent rendering across Gmail, Outlook, and Apple Mail.
 */

const F = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const ORANGE = `#FF8A3D`;

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * Wraps an HTML body fragment in Dirac's standard light-mode email chrome.
 * Same design system as the trial-reminder Supabase edge function.
 */
export function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dirac</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:520px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 18px;">
              <span style="font-family:${F};font-size:13px;font-weight:700;letter-spacing:0.06em;color:${ORANGE};">DIRAC</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;padding:32px 32px 28px;">
              ${bodyHtml}
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

// ── Welcome email ─────────────────────────────────────────────────────────────

function getFirstName(nameOrEmail: string): string {
  const fromName = nameOrEmail.trim().split(/\s+/)[0];
  if (fromName && !fromName.includes("@")) return fromName;
  const local = nameOrEmail.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

interface WelcomeEmailParams {
  name: string | null;
  email: string;
  inboxUrl: string;
}

export function buildWelcomeEmail({ name, email, inboxUrl }: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = getFirstName(name ?? email);

  const steps: { n: string; label: string; detail: string }[] = [
    {
      n: "1",
      label: "Open your inbox",
      detail: "Your threads are already loaded and sorted by what needs attention.",
    },
    {
      n: "2",
      label: "Check the Morning Brief",
      detail: "Click the sunrise icon in the header for your daily AI summary.",
    },
    {
      n: "3",
      label: "Reply with AI",
      detail: "Open any thread, hit Reply, and click the sparkle button to draft.",
    },
  ];

  const stepsHtml = steps
    .map(
      (s) => `
    <tr>
      <td style="padding:0 0 16px;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:1px;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background-color:#fff7ed;border:1px solid #fed7aa;font-family:${F};font-size:11px;font-weight:700;color:${ORANGE};text-align:center;line-height:20px;">${s.n}</span>
            </td>
            <td style="vertical-align:top;padding-left:10px;">
              <p style="margin:0 0 2px;font-family:${F};font-size:14px;font-weight:600;color:#111111;">${s.label}</p>
              <p style="margin:0;font-family:${F};font-size:13px;line-height:1.55;color:#71717a;">${s.detail}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
    )
    .join("");

  const bodyHtml = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${firstName},</p>

    <!-- Headline -->
    <h1 style="margin:0 0 8px;font-family:${F};font-size:24px;font-weight:700;letter-spacing:-0.025em;line-height:1.2;color:#111111;">Your inbox is ready.</h1>
    <p style="margin:0 0 28px;font-family:${F};font-size:15px;line-height:1.6;color:#3f3f46;">
      Dirac is a decision-first inbox built for people who live in email. Here are three things worth trying today.
    </p>

    <!-- Steps -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      ${stepsHtml}
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td style="height:1px;background-color:#f4f4f5;"></td></tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${ORANGE};border-radius:5px;">
          <a href="${inboxUrl}" style="display:inline-block;padding:12px 24px;font-family:${F};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open my inbox &rarr;</a>
        </td>
      </tr>
    </table>

    <!-- Trial note -->
    <p style="margin:0 0 20px;font-family:${F};font-size:13px;line-height:1.55;color:#a1a1aa;">
      You have <strong style="color:#3f3f46;">7 days free</strong>. Your card won&rsquo;t be charged until day 8. Cancel anytime before then from Settings &rarr; Billing. Questions? Just reply here.
    </p>

    <!-- Sign-off -->
    <p style="margin:0;font-family:${F};font-size:14px;color:#3f3f46;">
      &mdash; Dirac
    </p>`;

  const html = emailShell(bodyHtml);

  const text = `Hi ${firstName},

Your inbox is ready.

Dirac is a decision-first inbox built for people who live in email. Here are three things worth trying today.

1. Open your inbox
   Your threads are already loaded and sorted by what needs attention.

2. Check the Morning Brief
   Click the sunrise icon in the header for your daily AI summary.

3. Reply with AI
   Open any thread, hit Reply, and click the sparkle button to draft.

Open my inbox: ${inboxUrl}

You have 7 days free. Your card won't be charged until day 8. Cancel anytime from Settings → Billing. Questions? Just reply here.

— Dirac`;

  return {
    subject: "Welcome to Dirac — your 7-day trial starts now",
    html,
    text,
  };
}

// ── Cancel during trial ───────────────────────────────────────────────────────

interface CancelDuringTrialParams {
  name: string | null;
  email: string;
  trialEndDate: string; // formatted long date e.g. "Monday, June 30, 2026"
  reactivateUrl: string;
}

export function buildCancelDuringTrialEmail({
  name,
  email,
  trialEndDate,
  reactivateUrl,
}: CancelDuringTrialParams): { subject: string; html: string; text: string } {
  const firstName = getFirstName(name ?? email);

  const bodyHtml = `
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${firstName},</p>

    <h1 style="margin:0 0 8px;font-family:${F};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;color:#111111;">No hard feelings.</h1>
    <p style="margin:0 0 24px;font-family:${F};font-size:15px;line-height:1.6;color:#3f3f46;">
      You&rsquo;ve cancelled your Dirac trial. Your access will continue until <strong>${trialEndDate}</strong> &mdash; nothing changes until then.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:5px;padding:14px 18px;">
          <p style="margin:0;font-family:${F};font-size:13px;line-height:1.55;color:#3f3f46;">
            Your card <strong>won&rsquo;t be charged</strong>. If you change your mind before ${trialEndDate}, you can reactivate below and pick up right where you left off.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="border:1px solid #e4e4e7;border-radius:5px;">
          <a href="${reactivateUrl}" style="display:inline-block;padding:11px 22px;font-family:${F};font-size:14px;font-weight:600;color:#111111;text-decoration:none;">Reactivate &rarr;</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-family:${F};font-size:13px;line-height:1.55;color:#71717a;">
      Was there something we could have done better? Just reply here &mdash; I read every message.
    </p>

    <p style="margin:0;font-family:${F};font-size:14px;color:#3f3f46;">&mdash; Peter</p>`;

  const html = emailShell(bodyHtml);

  const text = `Hi ${firstName},

No hard feelings.

You've cancelled your Dirac trial. Your access will continue until ${trialEndDate} — nothing changes until then.

Your card won't be charged. If you change your mind before ${trialEndDate}, reactivate here: ${reactivateUrl}

Was there something we could have done better? Just reply here — I read every message.

— Peter`;

  return {
    subject: "You've cancelled your Dirac trial",
    html,
    text,
  };
}

// ── Cancel after trial (active subscription) ──────────────────────────────────

interface CancelAfterTrialParams {
  name: string | null;
  email: string;
  reactivateUrl: string;
}

export function buildCancelAfterTrialEmail({
  name,
  email,
  reactivateUrl,
}: CancelAfterTrialParams): { subject: string; html: string; text: string } {
  const firstName = getFirstName(name ?? email);

  const bodyHtml = `
    <p style="margin:0 0 6px;font-family:${F};font-size:13px;color:#71717a;">Hi ${firstName},</p>

    <h1 style="margin:0 0 8px;font-family:${F};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;color:#111111;">Your subscription has been cancelled.</h1>
    <p style="margin:0 0 24px;font-family:${F};font-size:15px;line-height:1.6;color:#3f3f46;">
      Access will continue until the end of your current billing period. After that, your inbox history and settings stay safe &mdash; everything will be here if you come back.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:5px;padding:14px 18px;">
          <p style="margin:0;font-family:${F};font-size:13px;line-height:1.55;color:#3f3f46;">
            You can reactivate anytime from <strong>Settings &rarr; Billing</strong>. No new setup needed.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="border:1px solid #e4e4e7;border-radius:5px;">
          <a href="${reactivateUrl}" style="display:inline-block;padding:11px 22px;font-family:${F};font-size:14px;font-weight:600;color:#111111;text-decoration:none;">Reactivate &rarr;</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-family:${F};font-size:13px;line-height:1.55;color:#71717a;">
      Why did you cancel? I&rsquo;d genuinely like to know &mdash; just reply here.
    </p>

    <p style="margin:0;font-family:${F};font-size:14px;color:#3f3f46;">&mdash; Peter</p>`;

  const html = emailShell(bodyHtml);

  const text = `Hi ${firstName},

Your subscription has been cancelled.

Access will continue until the end of your current billing period. After that, your inbox history and settings stay safe — everything will be here if you come back.

You can reactivate anytime from Settings → Billing. No new setup needed.

Reactivate: ${reactivateUrl}

Why did you cancel? I'd genuinely like to know — just reply here.

— Peter`;

  return {
    subject: "Your Dirac subscription has been cancelled",
    html,
    text,
  };
}

// ── Resend sender ─────────────────────────────────────────────────────────────

interface SendEmailOptions {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(
  opts: SendEmailOptions,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
