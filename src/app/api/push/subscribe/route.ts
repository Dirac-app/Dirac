/**
 * Push Subscription API Route
 * POST /api/push/subscribe
 * 
 * Saves a push subscription for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import webpush from "web-push";
import { pushConfig } from "@/lib/push-config";
import { pushSubscriptionSchema } from "./schema";

function initVapid(): boolean {
  if (!pushConfig.publicKey || !pushConfig.privateKey) return false;
  webpush.setVapidDetails(pushConfig.subject, pushConfig.publicKey, pushConfig.privateKey);
  return true;
}

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
  if (!initVapid()) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = pushSubscriptionSchema.parse(body);
    
    const userId = parsed.userId || session.user.email;
    const subscription = parsed.subscription;

    // Store subscription
    subscriptions.set(userId, subscription);

    // Send confirmation notification
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          type: "confirmation",
          title: "Notifications Enabled",
          body: "You'll now receive push notifications from Dirac.",
          tag: "confirmation",
        })
      );
    } catch {
      // Ignore notification errors (subscription might be expired)
    }

    return NextResponse.json({
      success: true,
      message: "Subscription saved",
    });
  } catch (error) {
    console.error("[Push Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    const subscription = subscriptions.get(userId);

    return NextResponse.json({
      subscribed: !!subscription,
      subscription: subscription || null,
    });
  } catch (error) {
    console.error("[Push Subscribe] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription" },
      { status: 500 }
    );
  }
}
