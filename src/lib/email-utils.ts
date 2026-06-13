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
      You have <strong style="color:#3f3f46;">14 days free</strong>. No card required. If you have any questions, just reply to this email.
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

You have 14 days free. No card required. If you have any questions, just reply to this email.

— Dirac`;

  return {
    subject: "Welcome to Dirac — your inbox is ready",
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
