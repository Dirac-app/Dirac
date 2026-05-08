/**
 * Zod schema for push subscription validation
 */

import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  userId: z.string().optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const pushTestSchema = z.object({
  type: z.enum(["urgent_email", "reply_received", "ai_digest"]),
  userId: z.string().optional(),
});
