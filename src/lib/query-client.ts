"use client";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds stale time for thread lists
      refetchOnWindowFocus: true, // Background refetch on window focus
      retry: 1,
    },
  },
});

// Query keys for type-safe cache management
export const queryKeys = {
  gmailThreads: ["gmail", "threads"] as const,
  outlookThreads: ["outlook", "threads"] as const,
  discordThreads: ["discord", "threads"] as const,
  threadMessages: (platform: string, threadId: string) =>
    [platform, "threads", threadId, "messages"] as const,
};
