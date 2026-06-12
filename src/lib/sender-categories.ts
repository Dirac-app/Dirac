/**
 * Sender-level AI category cache (localStorage only — no server storage).
 *
 * Categories are keyed by lowercase sender email so they are shared across
 * ALL threads from that sender in both the inbox and the senders page.
 * One AI call covers every thread that person ever sends.
 */

import type { FounderCategory } from "@/lib/types";

const KEY = "dirac:sender_ai_cats_v1";

export function loadSenderAiCategories(): Record<string, FounderCategory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, FounderCategory>) : {};
  } catch {
    return {};
  }
}

export function saveSenderAiCategories(cats: Record<string, FounderCategory>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cats));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

export function getSenderAiCategory(email: string): FounderCategory | undefined {
  const cats = loadSenderAiCategories();
  return cats[email.toLowerCase()];
}

export function setSenderAiCategory(email: string, cat: FounderCategory): void {
  const cats = loadSenderAiCategories();
  cats[email.toLowerCase()] = cat;
  saveSenderAiCategories(cats);
}
