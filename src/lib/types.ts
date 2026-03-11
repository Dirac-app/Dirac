// Dirac shared types (mirrors Prisma models for client use)

export type Platform = "GMAIL" | "OUTLOOK" | "DISCORD" | "INSTAGRAM" | "SLACK";

export type ThreadStatus = "INBOX" | "DONE" | "SNOOZED" | "ARCHIVED";

export interface DiracThread {
  id: string;
  platform: Platform;
  subject: string;
  snippet: string;
  isUnread: boolean;
  isStarred: boolean;
  isUrgent: boolean;
  messageCount: number;
  lastMessageAt: string; // ISO date
  participants: { name: string; email: string; avatarUrl?: string }[];
  status: ThreadStatus;
  tags: string[];
  urgencyScore?: number;
  isPinned: boolean;
}

export interface DiracMessage {
  id: string;
  threadId: string;
  fromName: string;
  fromAddress: string;
  toAddresses: string[];
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  sentAt: string; // ISO date
}

export type TriageCategory = "needs_reply" | "waiting_on" | "fyi" | "automated";

export const TRIAGE_LABELS: Record<TriageCategory, string> = {
  needs_reply: "Needs reply",
  waiting_on: "Waiting on",
  fyi: "FYI",
  automated: "Automated",
};

export type InboxFilter =
  | "all"
  | "unread"
  | "starred"
  | "urgent"
  | "waiting_on";
