/**
 * Push Send Notification API Route
 * POST /api/push/send
 * 
 * Server-side endpoint to trigger push notifications
 * Use this from your email sync workers
 */

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { pushConfig } from "@/lib/push-config";

const subscriptions = new Map<string, PushSubscriptionJSON>();

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushNotificationRequest {
  type: "urgent_email" | "reply_received" | "ai_digest";
  userId?: string;
  data?: {
    subject?: string;
    sender?: string;
    preview?: string;
    threadId?: string;
    messageId?: string;
    url?: string;
    [key: string]: unknown;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  requireInteraction?: boolean;
  urgency?: "low" | "normal" | "critical";
  data: Record<string, unknown>;
}

// Notification templates
const templates: Record<string, (data?: PushNotificationRequest["data"]) => NotificationPayload> = {
  urgent_email: (data) => ({
    title: "Urgent Email",
    body: data?.subject 
      ? `From: ${data.sender}\n${data.preview || ""}` 
      : "You have a new urgent email",
    tag: "urgent-email",
    requireInteraction: true,
    urgency: "critical",
    data: {
      threadId: data?.threadId,
      messageId: data?.messageId,
      url: data?.url || "/",
    },
  }),
  reply_received: (data) => ({
    title: `New Reply from ${data?.sender || "Someone"}`,
    body: data?.preview 
      ? data.preview.slice(0, 100) 
      : "Someone replied to your email",
    tag: "reply-received",
    data: {
      url: data?.url || "/",
      threadId: data?.threadId,
    },
  }),
  ai_digest: (data) => ({
    title: "Your AI Digest is Ready",
    body: data?.preview 
      ? data.preview 
      : "View your daily AI summary",
    tag: "ai-digest",
    data: {
      url: data?.url || "/activity",
    },
  }),
};

export async function POST(request: NextRequest) {
  try {
    // Verify API key for server-to-server calls
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== process.env.PUSH_API_KEY) {
      // Allow authenticated users as well
      const session = await import("@/lib/auth").then(m => m.auth());
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: PushNotificationRequest = await request.json();
    const { type, userId, data } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const subscription = subscriptions.get(userId);
    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found", subscribed: false },
        { status: 200 }
      );
    }

    const template = templates[type](data);
    const payload = JSON.stringify({
      type,
      title: template.title,
      body: template.body,
      tag: template.tag,
      requireInteraction: template.requireInteraction,
      urgency: template.urgency,
      data: template.data,
      timestamp: Date.now(),
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({
      success: true,
      message: `Notification sent: ${type}`,
    });
  } catch (error) {
    console.error("[Push Send] Error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

// Admin endpoint to list subscriptions (for debugging)
export async function GET() {
  const session = await import("@/lib/auth").then(m => m.auth());
  
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    subscriptionCount: subscriptions.size,
  });
}
