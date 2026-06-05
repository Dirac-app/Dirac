import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getUserById } from "@/lib/users-db";
import { requiresUpgrade, resolveSubscriptionStatus } from "@/lib/subscription";

// ── In-memory rate limiter ────────────────────────────────────────────────────

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/gmail/send": { max: 30, windowMs: 60_000 },
  "/api/outlook/send": { max: 30, windowMs: 60_000 },
  "/api/discord/send": { max: 60, windowMs: 60_000 },
  "/api/ai": { max: 40, windowMs: 60_000 },
  "/api/oauth": { max: 20, windowMs: 60_000 },
  "/api": { max: 200, windowMs: 60_000 },
};

const APP_PATHS = [
  "/inbox",
  "/compose",
  "/settings",
  "/activity",
  "/paper-trail",
  "/clips",
];

function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Paths reachable while subscription_status is expired (billing + auth only). */
const EXPIRED_ALLOW_PREFIXES = [
  "/upgrade",
  "/api/stripe",
  "/auth/",
  "/api/auth/",
];

function isExpiredBillingExempt(pathname: string): boolean {
  return EXPIRED_ALLOW_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

function getLimit(pathname: string) {
  for (const prefix of Object.keys(LIMITS).sort((a, b) => b.length - a.length)) {
    if (pathname.startsWith(prefix)) return LIMITS[prefix];
  }
  return null;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60_000) return;
  lastPrune = now;
  for (const [key, win] of store.entries()) {
    if (now > win.resetAt) store.delete(key);
  }
}

// ── Proxy: session refresh, billing gate, rate limits ─────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { supabaseResponse, user } = await updateSession(request);

  if (user && !isExpiredBillingExempt(pathname)) {
    const appUser = await getUserById(user.id);
    if (appUser) {
      const status = await resolveSubscriptionStatus(appUser);
      if (requiresUpgrade(status)) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname === "/upgrade" && user) {
    const appUser = await getUserById(user.id);
    if (appUser) {
      const status = await resolveSubscriptionStatus(appUser);
      if (!requiresUpgrade(status)) {
        const url = request.nextUrl.clone();
        url.pathname = "/inbox";
        return NextResponse.redirect(url);
      }
    }
  }

  if (isAppPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/signup" && user) {
    const appUser = await getUserById(user.id);
    if (appUser) {
      const status = await resolveSubscriptionStatus(appUser);
      if (requiresUpgrade(status)) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
      if (appUser.onboarding_completed_at) {
        const url = request.nextUrl.clone();
        url.pathname = "/inbox";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname.startsWith("/api/")) {
    const limit = getLimit(pathname);
    if (limit) {
      const ip = getClientIp(request);
      const key = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;

      maybePrune();

      if (!checkRateLimit(key, limit.max, limit.windowMs)) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "X-RateLimit-Limit": String(limit.max),
            },
          },
        );
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
