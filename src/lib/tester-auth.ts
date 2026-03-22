import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'dirac-tester-session';
const EXPIRY = '30d';

function getSecret(): string {
  const secret = process.env.TESTER_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TESTER_JWT_SECRET environment variable is required');
    }
    return 'dev-tester-secret-change-in-production';
  }
  return secret;
}

export interface TesterPayload {
  codeId: number;
  testerName: string;
  iat?: number;
  exp?: number;
}

export function issueTesterToken(codeId: number, testerName: string): string {
  const payload: TesterPayload = { codeId, testerName };
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRY });
}

export function verifyTesterToken(token: string): TesterPayload | null {
  try {
    return jwt.verify(token, getSecret()) as TesterPayload;
  } catch {
    return null;
  }
}

export function setTesterCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
    path: '/',
  });
}

export function clearTesterCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function getTesterSession(request: NextRequest): TesterPayload | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyTesterToken(token);
}
