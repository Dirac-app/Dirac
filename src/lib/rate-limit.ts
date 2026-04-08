/**
 * In-memory sliding-window rate limiter.
 *
 * Designed for single-instance deployments (Docker / standalone Next.js).
 * For multi-instance or serverless, swap the store for Redis/Upstash.
 *
 * Usage:
 *   const result = rateLimiters.chat.check(userId);
 *   if (!result.ok) return rateLimitResponse(result);
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
}

class SlidingWindowLimiter {
  /** userId → timestamps of requests within the window */
  private readonly store = new Map<string, number[]>();
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {
    // Prune stale entries every 10 minutes to prevent unbounded memory growth
    if (typeof setInterval !== "undefined") {
      this.pruneTimer = setInterval(() => this.prune(), 10 * 60 * 1000);
      // Don't keep the process alive for this timer alone
      if (this.pruneTimer?.unref) this.pruneTimer.unref();
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const hits = (this.store.get(key) ?? []).filter((t) => t > cutoff);
    const remaining = Math.max(0, this.max - hits.length);

    if (hits.length >= this.max) {
      // Oldest hit + windowMs = when the next slot opens
      const resetInMs = hits[0] + this.windowMs - now;
      return { ok: false, limit: this.max, remaining: 0, resetInMs };
    }

    hits.push(now);
    this.store.set(key, hits);
    return { ok: true, limit: this.max, remaining: remaining - 1, resetInMs: 0 };
  }

  private prune() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, hits] of this.store) {
      const fresh = hits.filter((t) => t > cutoff);
      if (fresh.length === 0) this.store.delete(key);
      else this.store.set(key, fresh);
    }
  }
}

/**
 * Named rate limiters — import and call .check(userId) in each route.
 */
export const rateLimiters = {
  /** AI chat: 30 req / 5 min */
  chat: new SlidingWindowLimiter(30, 5 * 60 * 1000),

  /** Quick-draft generation: 20 req / 5 min */
  quickDrafts: new SlidingWindowLimiter(20, 5 * 60 * 1000),

  /** Background tasks (triage, tone, briefing, etc.): 120 req / hour */
  background: new SlidingWindowLimiter(120, 60 * 60 * 1000),
} as const;

/**
 * Returns a 429 NextResponse with standard rate-limit headers.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil(result.resetInMs / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": "0",
        "Retry-After":           String(retryAfterSec),
      },
    },
  );
}

// ─── Invite-code lockout (IP-based) ───────────────────────────────────────────
// Used by /api/tester/validate-code to prevent brute-forcing invite codes.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS   = 15 * 60 * 1000; // 15 minutes

interface LockoutEntry {
  failures:  number;
  lockedUntil: number | null;
}

const inviteLockout = new Map<string, LockoutEntry>();

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function checkRateLimit(ip: string): { allowed: boolean; resetAt: Date } {
  const entry = inviteLockout.get(ip);
  const now   = Date.now();

  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, resetAt: new Date(entry.lockedUntil) };
  }

  return { allowed: true, resetAt: new Date(now + LOCKOUT_WINDOW_MS) };
}

export function recordFailedAttempt(ip: string): { attemptsRemaining: number; resetAt: Date } {
  const now   = Date.now();
  const entry = inviteLockout.get(ip) ?? { failures: 0, lockedUntil: null };

  entry.failures += 1;

  if (entry.failures >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_WINDOW_MS;
    inviteLockout.set(ip, entry);
    return { attemptsRemaining: 0, resetAt: new Date(entry.lockedUntil) };
  }

  inviteLockout.set(ip, entry);
  return {
    attemptsRemaining: MAX_FAILED_ATTEMPTS - entry.failures,
    resetAt: new Date(now + LOCKOUT_WINDOW_MS),
  };
}

export function recordSuccess(ip: string): void {
  inviteLockout.delete(ip);
}
