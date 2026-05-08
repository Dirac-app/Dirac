/**
 * Push Notifications Provider
 * Registers service worker and manages push notification state
 * 
 * Usage: Wrap your app with this provider
 */

"use client";

import { useEffect, useState } from "react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";

interface PushProviderProps {
  children: React.ReactNode;
  userId: string;
  autoSubscribe?: boolean;
}

export function PushProvider({
  children,
  userId,
  autoSubscribe = false,
}: PushProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [swrRegistration, setSwrRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const {
    isSupported,
    permissionStatus,
    isSubscribed,
    subscribe,
  } = usePushNotifications({
    userId,
  });

  // Register service worker on mount
  useEffect(() => {
    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        
        setSwrRegistration(registration);
        console.log("[Push] Service Worker registered:", registration.scope);
        
        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[Push] New content available, refresh to update");
              }
            });
          }
        });
      } catch (error) {
        console.error("[Push] Service Worker registration failed:", error);
      }
    };

    registerServiceWorker();
  }, []);

  // Auto-subscribe if enabled and supported
  useEffect(() => {
    if (isSupported && autoSubscribe && permissionStatus === "granted" && !isSubscribed) {
      subscribe();
    }
  }, [isSupported, autoSubscribe, permissionStatus, isSubscribed, subscribe]);

  // Listen for controller changes
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      console.log("[Push] Service worker controller changed");
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    setIsReady(true);
  }, [swrRegistration]);

  if (!isReady) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
