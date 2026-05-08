/**
 * Push Settings Component
 * UI for managing push notification preferences
 * 
 * Use in Settings page to let users enable/disable notifications
 */

"use client";

import { useState } from "react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { Bell, BellOff, AlertTriangle, MessageSquare, Sparkles } from "lucide-react";

interface PushSettingsProps {
  userId: string;
}

export function PushSettings({ userId }: PushSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  
  const {
    isSupported,
    permissionStatus,
    isSubscribed,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications({
    userId,
  });

  const handleSubscribe = async () => {
    setIsLoading(true);
    await subscribe();
    setIsLoading(false);
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    await unsubscribe();
    setIsLoading(false);
  };

  const handleTestNotification = async (type: "urgent_email" | "reply_received" | "ai_digest") => {
    setIsLoading(true);
    try {
      await sendTestNotification(type);
      setLastSent(type);
      setTimeout(() => setLastSent(null), 3000);
    } catch (error) {
      console.error("Failed to send test:", error);
    }
    setIsLoading(false);
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission Status */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          {permissionStatus === "granted" ? (
            <Bell className="w-5 h-5 text-green-600" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium">
              {permissionStatus === "granted" ? "Notifications Enabled" : "Notifications Disabled"}
            </p>
            <p className="text-sm text-gray-500">
              Permission: {permissionStatus}
            </p>
          </div>
        </div>
        
        {permissionStatus === "granted" ? (
          <button
            onClick={handleUnsubscribe}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Disable"}
          </button>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Enable Notifications"}
          </button>
        )}
      </div>

      {/* Subscription Status */}
      {isSubscribed && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">
            You are subscribed to push notifications.
          </p>
        </div>
      )}

      {/* Test Notifications */}
      {isSubscribed && permissionStatus === "granted" && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Test Notifications</h3>
          <p className="text-sm text-gray-500">
            Send a test notification to verify everything is working.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TestButton
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Urgent Email"
              onClick={() => handleTestNotification("urgent_email")}
              isLoading={isLoading}
              lastSent={lastSent === "urgent_email"}
            />
            <TestButton
              icon={<MessageSquare className="w-4 h-4" />}
              label="Reply"
              onClick={() => handleTestNotification("reply_received")}
              isLoading={isLoading}
              lastSent={lastSent === "reply_received"}
            />
            <TestButton
              icon={<Sparkles className="w-4 h-4" />}
              label="AI Digest"
              onClick={() => handleTestNotification("ai_digest")}
              isLoading={isLoading}
              lastSent={lastSent === "ai_digest"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface TestButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isLoading: boolean;
  lastSent: boolean;
}

function TestButton({ icon, label, onClick, isLoading, lastSent }: TestButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || lastSent}
      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
        lastSent
          ? "bg-green-100 border-green-300 text-green-800"
          : "bg-white border-gray-200 hover:bg-gray-50"
      }`}
    >
      {icon}
      <span>{lastSent ? "Sent!" : label}</span>
    </button>
  );
}
