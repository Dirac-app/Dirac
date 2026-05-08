/**
 * TypeScript types for Web Push Notifications
 */

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionData {
  userId: string;
  subscription: PushSubscriptionJSON;
  createdAt: number;
}

export interface PushNotificationData {
  type: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  timestamp?: number;
}

// Server-sent notification payload
export interface ServerPushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  urgency?: "low" | "normal" | "critical";
}
