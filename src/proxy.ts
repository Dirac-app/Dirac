import { NextRequest, NextResponse } from "next/server";
import { verifyTesterToken } from "@/lib/tester-auth";

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Uses a sliding window per IP. Suitable for single-instance deployments.
// For multi-instance (e.g. multiple Railway containers), replace with Redis.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  // Sending messages — strict
  "/api/gmail/send":   { max: 30,  windowMs: 60_000 },
  "/api/outlook/send": { max: 30,  windowMs: 60_000 },
  "/api/discord/send": { max: 60,  windowMs: 60_000 },
  // AI — moderate (costly per call)
  "/api/ai":           { max: 40,  windowMs: 60_000 },
  // OAuth flows — prevent abuse
  "/api/oauth":        { max: 20,  windowMs: 60_000 },
  // General API default
  "/api":              { max: 200, windowMs: 60_000 },
};

function getLimit(pathname: string) {
  // Match most-specific prefix first
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
    return true; // allowed
  }

  if (entry.count >= max) return false; // blocked

  entry.count++;
  return true; // allowed
}

// Prune expired entries every 5 minutes to prevent unbounded growth
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60_000) return;
  lastPrune = now;
  for (const [key, win] of store.entries()) {
    if (now > win.resetAt) store.delete(key);
  }
}

// ── Proxy (Next.js 16 replacement for middleware) ─────────────────────────────
// Route-level auth is handled inside each API handler via requireAuth().

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already authenticated users landing on the gate page → skip to inbox
  if (pathname === "/") {
    const token = request.cookies.get("dirac-tester-session")?.value;
    if (token && verifyTesterToken(token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/inbox";
      return NextResponse.redirect(url);
    }
  }

  const protectedPaths = ["/inbox", "/compose", "/settings", "/activity"];
  const isProtectedPath = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isProtectedPath) {
    const token = request.cookies.get("dirac-tester-session")?.value;
    const testerSession = token ? verifyTesterToken(token) : null;

    if (!testerSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Rate limiting for API routes
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*", "/inbox/:path*", "/compose/:path*", "/settings/:path*", "/activity/:path*"],
};
