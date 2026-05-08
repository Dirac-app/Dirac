/**
 * Dirac Push Notification Configuration
 * VAPID keys for Web Push API
 * 
 * Generate new keys: npx web-push generate-vapid-keys
 */

export const pushConfig = {
  subject: process.env.VAPID_SUBJECT ?? "mailto:support@dirac.app",
  publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
} as const;

// Notification types
export type PushNotificationType = 
  | "urgent_email"
  | "reply_received"
  | "ai_digest";

export interface PushNotificationPayload {
  type: PushNotificationType;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

// Permission states
export type PushPermissionStatus = "granted" | "denied" | "default";
