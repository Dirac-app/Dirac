/**
 * Push Test Notification API Route
 * POST /api/push/test
 * 
 * Sends a test notification to verify push is working
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import webpush from "web-push";
import { pushConfig } from "@/lib/push-config";
import { pushTestSchema } from "../subscribe/schema";

// In-memory storage
const subscriptions = new Map<string, PushSubscriptionJSON>();

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationTemplates {
  urgent_email: {
    title: string;
    body: string;
  };
  reply_received: {
    title: string;
    body: string;
  };
  ai_digest: {
    title: string;
    body: string;
  };
}

const notificationTemplates: NotificationTemplates = {
  urgent_email: {
    title: "Urgent Email",
    body: "You have a new urgent email that needs attention.",
  },
  reply_received: {
    title: "New Reply",
    body: "Someone replied to your email.",
  },
  ai_digest: {
    title: "AI Digest Ready",
    body: "Your daily AI summary is ready to view.",
  },
};

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
    const { type } = pushTestSchema.parse(body);

    const userId = session.user.email;
    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return NextResponse.json(
        { error: "Not subscribed" },
        { status: 400 }
      );
    }

    const template = notificationTemplates[type as keyof NotificationTemplates];

    // Send notification
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        type,
        title: template.title,
        body: template.body,
        tag: `test-${type}`,
        requireInteraction: type === "urgent_email",
        timestamp: Date.now(),
      })
    );

    return NextResponse.json({
      success: true,
      message: "Test notification sent",
    });
  } catch (error) {
    console.error("[Push Test] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
