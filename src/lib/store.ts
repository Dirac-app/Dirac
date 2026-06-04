"use client";

import { createContext, useContext } from "react";
import type {
  DiracThread,
  DiracMessage,
  InboxFilter,
  TriageCategory,
  FounderCategory,
  CategoryTab,
  Commitment,
  SnoozeState,
  RelationshipContext,
  PatternSuggestion,
  TopicTag,
} from "./types";

// ─── Shared types ───────────────────────────────────────────────────────────

export type ToneContext =
  | "cold_outreach"
  | "client_customer"
  | "internal_team"
  | "formal_professional"
  | "casual_personal"
  | "follow_ups";

export const TONE_CONTEXT_LABELS: Record<ToneContext, string> = {
  cold_outreach: "Cold outreach",
  client_customer: "Client / customer",
  internal_team: "Internal team",
  formal_professional: "Formal / professional",
  casual_personal: "Casual / personal",
  follow_ups: "Follow-ups & reminders",
};

export interface ConditionalTone {
  context: ToneContext;
  tone: string;
  formality: "formal" | "semi-formal" | "casual" | "very-casual";
  traits: string[];
  example_phrases: string[];
}

export interface ToneProfile {
  summary: string;
  formality: "formal" | "semi-formal" | "casual" | "very-casual";
  traits: string[];
  greeting_style: string;
  signoff_style: string;
  example_phrases: string[];
  conditional_tones?: ConditionalTone[];
}

export interface AiContextItem {
  id: string;
  label: string;
  type?: "thread" | "message" | "clip";
  threadId?: string;
  messageId?: string;
}

export interface Clip {
  id: string;
  threadId: string;
  threadSubject: string;
  content: string;
  type: "text" | "link" | "quote";
  createdAt: string;
}

// ─── ThreadsContext — thread list, messages, loading ──────────────────────

export interface ThreadsContextValue {
  // Thread list
  threads: DiracThread[];
  threadsLoading: boolean;
  refreshThreads: () => void;
  loadMoreThreads: () => void;
  loadingMoreThreads: boolean;
  hasMoreThreads: boolean;
  // Messages
  messages: DiracMessage[];
  messagesLoading: boolean;
  // Thread actions (mutate threads/messages)
  toggleStarred: (threadId: string) => void;
  toggleUrgent: (threadId: string) => void;
  markThreadUnread: (threadId: string) => void;
  markThreadRead: (threadId: string) => void;
  archiveThread: (threadId: string) => void;
  trashThread: (threadId: string) => void;
  // Derived from threads
  unreadCount: number;
}

export const ThreadsContext = createContext<ThreadsContextValue | null>(null);

export function useThreads() {
  const ctx = useContext(ThreadsContext);
  if (!ctx) throw new Error("useThreads must be used within AppProvider");
  return ctx;
}

// ─── UIContext — sidebar, compose, filter, density, search ────────────────

export interface UIContextValue {
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  inboxFilter: InboxFilter;
  setInboxFilter: (filter: InboxFilter) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeMinimized: boolean;
  setComposeMinimized: (min: boolean) => void;
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within AppProvider");
  return ctx;
}

// ─── SelectionContext — active thread, bulk selection ──────────────────────

export interface SelectionContextValue {
  selectedThreadId: string | null;
  setSelectedThreadId: (id: string | null) => void;
  selectedThreadIds: Set<string>;
  toggleBulkSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
}

export const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within AppProvider");
  return ctx;
}

// ─── Full AppState (still used by some consumers who need everything) ───────
// Kept for backward compatibility. New components should use the focused hooks.

export interface AppState {
  selectedThreadId: string | null;
  setSelectedThreadId: (id: string | null) => void;
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  inboxFilter: InboxFilter;
  setInboxFilter: (filter: InboxFilter) => void;
  threads: DiracThread[];
  threadsLoading: boolean;
  messages: DiracMessage[];
  messagesLoading: boolean;
  refreshThreads: () => void;
  loadMoreThreads: () => void;
  loadingMoreThreads: boolean;
  hasMoreThreads: boolean;
  // Compose panel
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeMinimized: boolean;
  setComposeMinimized: (min: boolean) => void;
  // Tone profile
  toneProfile: ToneProfile | null;
  setToneProfile: (profile: ToneProfile | null) => void;
  // Thread actions
  toggleStarred: (threadId: string) => void;
  toggleUrgent: (threadId: string) => void;
  markThreadUnread: (threadId: string) => void;
  markThreadRead: (threadId: string) => void;
  archiveThread: (threadId: string) => void;
  trashThread: (threadId: string) => void;
  // AI context (shared between sidebar + thread view)
  aiContext: AiContextItem[];
  addToAiContext: (item: AiContextItem) => void;
  removeFromAiContext: (id: string) => void;
  toggleAiContext: (item: AiContextItem) => void;
  clearAiContext: () => void;
  isInAiContext: (id: string) => boolean;
  // Triage
  triageMap: Record<string, TriageCategory>;
  triageLoading: boolean;
  runTriage: () => void;
  // AI query handoff (spotlight → sidebar)
  pendingAiQuery: string | null;
  setPendingAiQuery: (query: string | null) => void;
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Density
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  // Bulk select
  selectedThreadIds: Set<string>;
  toggleBulkSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  // Unread count
  unreadCount: number;
  // Thread lifecycle (Direction A)
  snoozedThreads: SnoozeState[];
  snoozeThread: (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">) => void;
  unsnoozeThread: (threadId: string) => void;
  doneThreads: Set<string>;
  markDone: (threadId: string) => void;
  unmarkDone: (threadId: string) => void;
  commitments: Commitment[];
  setCommitments: (commitments: Commitment[]) => void;
  dismissCommitment: (id: string) => void;
  // Founder categories (Direction B)
  categoryMap: Record<string, FounderCategory>;
  setCategoryMap: (updater: (prev: Record<string, FounderCategory>) => Record<string, FounderCategory>) => void;
  categoryLoading: boolean;
  runCategorization: () => void;
  // Dynamic category tabs
  categoryTabMap: Record<string, string>;
  categoryTabs: CategoryTab[];
  setCategoryTabs: (tabs: CategoryTab[]) => void;
  activeTab: string;
  setActiveTab: (id: string) => void;
  // Pattern suggestions (Direction B.3)
  patternSuggestions: PatternSuggestion[];
  dismissPattern: (id: string) => void;
  applyPattern: (id: string) => void;
  // Relationship context (Direction B.4)
  getRelationshipContext: (email: string) => RelationshipContext | null;
  // Topic tags (AI-generated from fixed set)
  topicMap: Record<string, TopicTag[]>;
  topicLoading: boolean;
  runTopicTagging: () => void;
  // Set aside
  setAsideThreadIds: string[];
  addToSetAside: (ids: string[]) => void;
  removeFromSetAside: (id: string) => void;
  clearSetAside: () => void;
  // View all overlay
  viewAllThreadIds: string[];
  viewAllOpen: boolean;
  openViewAll: (ids: string[]) => void;
  closeViewAll: () => void;
  // Clip library
  clips: Clip[];
  addClip: (clip: Omit<Clip, "id" | "createdAt">) => void;
  removeClip: (id: string) => void;
  // Undo system
  undoStack: Array<{ id: string; type: any; threadId: string; threadSubject?: string; timestamp: number }>;
  currentUndo: { action: { id: string; type: any; threadId: string; threadSubject?: string }; timeLeft: number } | null;
  pushUndoAction: (action: { type: any; threadId: string; threadSubject?: string }) => void;
  performUndo: () => void;
  dismissUndo: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
