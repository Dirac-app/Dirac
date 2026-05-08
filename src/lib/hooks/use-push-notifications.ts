/**
 * React hook for managing push notifications in Dirac
 * Handles subscription, permissions, and notification state
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { pushConfig, type PushPermissionStatus, type PushNotificationType } from "../push-config";

interface UsePushNotificationsOptions {
  userId?: string;
  onNotification?: (data: unknown) => void;
}

interface UsePushNotificationsResult {
  isSupported: boolean;
  permissionStatus: PushPermissionStatus;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: (type: PushNotificationType) => Promise<void>;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsResult {
  const { userId, onNotification } = options;
  
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check support on mount
  useEffect(() => {
    const checkSupport = () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);
      
      if (supported) {
        // Check current permission status
        const permission = Notification.permission;
        setPermissionStatus(permission as PushPermissionStatus);
        
        // Check for existing subscription
        navigator.serviceWorker.ready.then((registration) => {
          registration.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setSubscription(sub);
              setIsSubscribed(true);
            }
          });
        });
      }
    };
    
    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return null;
    
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as PushPermissionStatus);
      
      if (permission !== "granted") {
        console.warn("Push notification permission denied");
        return null;
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Convert VAPID public key
      const vapidKey = pushConfig.publicKey;
      if (!vapidKey) {
        console.error("VAPID public key not configured");
        return null;
      }
      
      const convertedKey = urlBase64ToBuffer(vapidKey);
      
      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
      
      // Save subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: pushSubscription.toJSON(),
          userId,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save subscription");
      }
      
      setSubscription(pushSubscription);
      setIsSubscribed(true);
      
      return pushSubscription;
    } catch (error) {
      console.error("Failed to subscribe to push:", error);
      return null;
    }
  }, [isSupported, userId]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    
    try {
      // Unsubscribe from push manager
      await subscription.unsubscribe();
      
      // Notify server
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });
      
      setSubscription(null);
      setIsSubscribed(false);
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
    }
  }, [subscription]);

  // Send test notification (server-side trigger)
  const sendTestNotification = useCallback(async (type: PushNotificationType) => {
    const response = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, userId }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to send test notification");
    }
  }, [userId]);

  return {
    isSupported,
    permissionStatus,
    isSubscribed,
    subscription,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}

// ============================================================================
// Helper: Convert VAPID key from base64 to ArrayBuffer
// ============================================================================

function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray.buffer;
}
