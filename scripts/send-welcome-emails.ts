import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getUserByEmail,
  getUsersNeedingWelcomeEmail,
} from "../src/lib/users-db";
import { sendWelcomeEmailIfNeeded } from "../src/lib/welcome-email";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.warn("No .env.local found — using existing environment variables.");
  }
}

function parseArgs(argv: string[]) {
  let dryRun = false;
  let force = false;
  let email: string | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("--email=")) email = arg.slice("--email=".length).trim();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run send-welcome-emails -- [options]

Options:
  --dry-run          List who would get an email; don't send
  --email=you@x.com  One user only
  --force            Send even if welcome_email_sent_at is set

Requires RESEND_API_KEY (+ SUPABASE_*) in .env.local or environment.`);
      process.exit(0);
    }
  }

  return { dryRun, force, email };
}

async function main() {
  loadEnvLocal();
  const { dryRun, force, email } = parseArgs(process.argv.slice(2));

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set.");
    process.exit(1);
  }

  const users = email
    ? await (async () => {
        const user = await getUserByEmail(email);
        return user ? [user] : [];
      })()
    : await getUsersNeedingWelcomeEmail();

  if (email && users.length === 0) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log("No users need a welcome email.");
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] Would send" : "Sending"} welcome email to ${users.length} user(s)…`,
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (dryRun) {
      console.log(`  • ${user.email}`);
      continue;
    }

    const result = await sendWelcomeEmailIfNeeded(user.id, { force });
    if (!result.ok) {
      console.error(`  ✗ ${user.email}: ${result.error}`);
      failed += 1;
    } else if (result.sent) {
      console.log(`  ✓ ${user.email}`);
      sent += 1;
    } else {
      console.log(`  – ${user.email} (already sent)`);
      skipped += 1;
    }
  }

  if (!dryRun) {
    console.log(`Done. sent=${sent} skipped=${skipped} failed=${failed}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
