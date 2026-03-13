// Dirac shared types (mirrors Prisma models for client use)

export type Platform = "GMAIL" | "OUTLOOK" | "DISCORD" | "INSTAGRAM" | "SLACK";

export type ThreadStatus = "INBOX" | "DONE" | "SNOOZED" | "ARCHIVED";

// ─── Founder-relevant categories (Direction B.1) ────────
export type FounderCategory =
  | "investor"
  | "customer"
  | "vendor"
  | "outreach"
  | "automated"
  | "personal";

export const FOUNDER_CATEGORY_LABELS: Record<FounderCategory, string> = {
  investor: "Investor",
  customer: "Customer",
  vendor: "Vendor",
  outreach: "Outreach",
  automated: "Automated",
  personal: "Personal",
};

export const FOUNDER_CATEGORY_COLORS: Record<FounderCategory, string> = {
  investor: "text-purple-600 bg-purple-500/10",
  customer: "text-emerald-600 bg-emerald-500/10",
  vendor: "text-blue-600 bg-blue-500/10",
  outreach: "text-amber-600 bg-amber-500/10",
  automated: "text-gray-500 bg-gray-500/10",
  personal: "text-pink-600 bg-pink-500/10",
};

// ─── Commitments (Direction A.3) ────────────────────────
export interface Commitment {
  id: string;
  threadId: string;
  description: string;
  owner: "me" | "them";
  dueDate?: string; // ISO date
  isOverdue: boolean;
  createdAt: string;
}

// ─── Snooze (Direction A.2) ─────────────────────────────
export type SnoozeMode = "time" | "reply" | "condition";

export interface SnoozeState {
  threadId: string;
  mode: SnoozeMode;
  until?: string; // ISO date for time-based
  condition?: string; // description for condition-based
  snoozedAt: string;
}

// ─── Relationship context (Direction B.4) ───────────────
export interface RelationshipContext {
  email: string;
  name: string;
  totalThreads: number;
  avgResponseTimeHours: number | null;
  theirAvgResponseTimeHours: number | null;
  toneUsed: string | null;
  recentSubjects: string[];
  lastContacted: string | null;
}

// ─── Pattern suggestions (Direction B.3) ────────────────
export interface PatternSuggestion {
  id: string;
  senderEmail: string;
  senderName: string;
  pattern: string; // "You archive 9/10 emails from this sender"
  suggestedAction: "archive" | "star" | "mark_read" | "mark_urgent";
  confidence: number; // 0-1
  dismissed: boolean;
}

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
  | "needs_reply"
  | "waiting_on"
  | "snoozed"
  | "done"
  | "unread"
  | "starred"
  | "urgent";
