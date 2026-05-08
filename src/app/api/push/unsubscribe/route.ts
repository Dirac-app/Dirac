/**
 * Push Unsubscribe API Route
 * POST /api/push/unsubscribe
 * 
 * Removes a push subscription for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// In-memory storage (replace with database in production)
const subscriptions = new Map<string, PushSubscriptionJSON>();

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { endpoint } = body;
    
    const userId = session.user.email;
    
    // Remove subscription if it matches the endpoint
    const existing = subscriptions.get(userId);
    if (existing?.endpoint === endpoint) {
      subscriptions.delete(userId);
    }

    return NextResponse.json({
      success: true,
      message: "Unsubscribed",
    });
  } catch (error) {
    console.error("[Push Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
