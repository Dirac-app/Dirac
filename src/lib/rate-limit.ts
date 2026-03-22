const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  resetAt: Date;
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    const newEntry: RateLimitEntry = { attempts: 0, windowStart: now };
    store.set(ip, newEntry);
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS, resetAt: new Date(now + WINDOW_MS) };
  }

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
  return { allowed: entry.attempts < MAX_ATTEMPTS, attemptsRemaining, resetAt: new Date(entry.windowStart + WINDOW_MS) };
}

export function recordFailedAttempt(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    const newEntry: RateLimitEntry = { attempts: 1, windowStart: now };
    store.set(ip, newEntry);
    return { allowed: MAX_ATTEMPTS - 1 > 0, attemptsRemaining: MAX_ATTEMPTS - 1, resetAt: new Date(now + WINDOW_MS) };
  }

  entry.attempts += 1;
  store.set(ip, entry);
  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
  return { allowed: attemptsRemaining > 0, attemptsRemaining, resetAt: new Date(entry.windowStart + WINDOW_MS) };
}

export function recordSuccess(ip: string): void {
  store.delete(ip);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '127.0.0.1';
}
