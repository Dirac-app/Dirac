/**
 * Email Templates API
 * 
 * Handles CRUD operations for user email templates.
 * Currently stubs database operations - templates are stored client-side.
 * This can be connected to a real database (Prisma/Postgres) in production.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// In-memory store for MVP (would be replaced with DB in production)
const templatesStore = new Map<string, unknown[]>();

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id ?? session.user.email ?? "default";
  const templates = templatesStore.get(userId) ?? [];

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id ?? session.user.email ?? "default";

  try {
    const { templates } = await request.json();
    
    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    templatesStore.set(userId, templates);

    return NextResponse.json({ 
      ok: true, 
      count: templates.length,
      message: "Templates synced to server" 
    });
  } catch {
    return NextResponse.json({ error: "Failed to sync templates" }, { status: 500 });
  }
}
