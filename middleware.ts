import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateEnv, getEnvSummary } from '@/lib/env';

/**
 * Middleware that validates environment variables on every request.
 * This ensures fail-fast behavior if env vars are misconfigured.
 */

export function middleware(request: NextRequest) {
  // Skip validation for static files and non-API routes in production
  // to avoid performance impact on every page load
  if (process.env.NODE_ENV === 'production') {
    // Only validate on /api routes in production
    if (!request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.next();
    }
  }

  // Run environment validation
  try {
    validateEnv();
  } catch (error) {
    const message = (error as Error).message;
    
    // Log the error
    console.error('Environment validation failed:', message);
    
    // Return a clear error response
    return new NextResponse(
      JSON.stringify({
        error: 'Configuration Error',
        message: 'Missing required environment variables. Please check server configuration.',
        details: process.env.NODE_ENV !== 'production' ? message : undefined,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Env-Error': 'true',
        },
      }
    );
  }

  return NextResponse.next();
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  // Run on all routes in development, only API routes in production
  matcher: process.env.NODE_ENV === 'production' 
    ? '/api/:path*' 
    : '/:path*',
};
