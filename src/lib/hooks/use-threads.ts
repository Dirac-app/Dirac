"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-client";
import type { DiracThread } from "../types";

// Type definitions for API responses
interface GmailThreadsResponse {
  threads: DiracThread[];
}

interface OutlookThreadsResponse {
  threads: DiracThread[];
}

interface DiscordThreadsResponse {
  threads: DiracThread[];
}

interface MessagesResponse {
  messages: unknown[];
}

// Custom hooks for thread fetching with React Query caching

export function useGmailThreads() {
  return useQuery({
    queryKey: queryKeys.gmailThreads,
    queryFn: async (): Promise<DiracThread[]> => {
      const res = await fetch("/api/gmail/threads");
      if (!res.ok) throw new Error("Gmail fetch failed");
      const data: GmailThreadsResponse = await res.json();
      return data.threads ?? [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useOutlookThreads() {
  return useQuery({
    queryKey: queryKeys.outlookThreads,
    queryFn: async (): Promise<DiracThread[]> => {
      const res = await fetch("/api/outlook/threads");
      if (!res.ok) throw new Error("Outlook fetch failed");
      const data: OutlookThreadsResponse = await res.json();
      return data.threads ?? [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useDiscordThreads() {
  return useQuery({
    queryKey: queryKeys.discordThreads,
    queryFn: async (): Promise<DiracThread[]> => {
      const res = await fetch("/api/discord/threads");
      if (!res.ok) throw new Error("Discord fetch failed");
      const data: DiscordThreadsResponse = await res.json();
      return data.threads ?? [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useThreadMessages(platform: string, threadId: string | null) {
  return useQuery({
    queryKey: queryKeys.threadMessages(platform, threadId ?? ""),
    queryFn: async () => {
      if (!threadId) return [];
      const apiUrl =
        platform === "discord"
          ? `/api/discord/threads/${threadId}`
          : platform === "outlook"
            ? `/api/outlook/threads/${threadId}`
            : `/api/gmail/threads/${threadId}`;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data: MessagesResponse = await res.json();
      return data.messages ?? [];
    },
    enabled: !!threadId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

// Optimistic update hook for mutations
export function useOptimisticUpdateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      action,
      platform,
    }: {
      threadId: string;
      action: string;
      platform: string;
    }) => {
      const isOutlook = platform === "outlook";
      const apiUrl = isOutlook
        ? `/api/outlook/threads/${threadId}`
        : `/api/gmail/threads/${threadId}`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error(`Action ${action} failed`);
      return res.json();
    },
    onMutate: async ({ threadId, action, platform }) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey: queryKeys.gmailThreads });
      await queryClient.cancelQueries({ queryKey: queryKeys.outlookThreads });

      // Snapshot current values for rollback
      const previousGmail = queryClient.getQueryData<DiracThread[]>(queryKeys.gmailThreads);
      const previousOutlook = queryClient.getQueryData<DiracThread[]>(queryKeys.outlookThreads);

      // Optimistically update based on action
      if (action === "archive" || action === "trash") {
        const queryKey = platform === "outlook" ? queryKeys.outlookThreads : queryKeys.gmailThreads;
        queryClient.setQueryData<DiracThread[]>(queryKey, (old) =>
          old?.filter((t) => t.id !== threadId) ?? []
        );
      } else if (action === "mark-read") {
        const queryKey = platform === "outlook" ? queryKeys.outlookThreads : queryKeys.gmailThreads;
        queryClient.setQueryData<DiracThread[]>(queryKey, (old) =>
          old?.map((t) => (t.id === threadId ? { ...t, isUnread: false } : t)) ?? []
        );
      } else if (action === "mark-unread") {
        const queryKey = platform === "outlook" ? queryKeys.outlookThreads : queryKeys.gmailThreads;
        queryClient.setQueryData<DiracThread[]>(queryKey, (old) =>
          old?.map((t) => (t.id === threadId ? { ...t, isUnread: true } : t)) ?? []
        );
      }

      return { previousGmail, previousOutlook };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousGmail) {
        queryClient.setQueryData(queryKeys.gmailThreads, context.previousGmail);
      }
      if (context?.previousOutlook) {
        queryClient.setQueryData(queryKeys.outlookThreads, context.previousOutlook);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.gmailThreads });
      queryClient.invalidateQueries({ queryKey: queryKeys.outlookThreads });
    },
  });
}

// Hook to manually refetch threads
export function useRefetchThreads() {
  const queryClient = useQueryClient();

  return {
    refetchAll: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmailThreads });
      queryClient.invalidateQueries({ queryKey: queryKeys.outlookThreads });
      queryClient.invalidateQueries({ queryKey: queryKeys.discordThreads });
    },
    refetchGmail: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmailThreads });
    },
    refetchOutlook: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outlookThreads });
    },
    refetchDiscord: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.discordThreads });
    },
  };
}
