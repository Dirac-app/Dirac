import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type AuthGuardResult =
  | { userId: string; error?: never; response?: never }
  | { userId?: never; error: string; response: NextResponse };

/**
 * Validates the current session and returns the authenticated userId (email).
 */
export async function requireAuth(): Promise<AuthGuardResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const userId = session.userId ?? session.user.email;
  if (!userId) {
    return {
      error: "User ID missing from session",
      response: NextResponse.json({ error: "Session invalid" }, { status: 401 }),
    };
  }

  return { userId };
}

/**
 * Lighter auth check — only requires a signed-in user.
 */
export async function requireSession(): Promise<
  { userId: string | null; error?: never; response?: never }
  | { userId?: never; error: string; response: NextResponse }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { userId: session.userId ?? session.user.email ?? null };
}

/**
 * Validates session and that the user has an active Gmail connection.
 */
export async function requireGmail(): Promise<
  AuthGuardResult & { accessToken?: string }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!session.accessToken) {
    return {
      error: "No Gmail access token",
      response: NextResponse.json({ error: "Gmail not connected" }, { status: 401 }),
    };
  }

  return { userId: session.userId ?? session.user.email ?? "", accessToken: session.accessToken };
}
