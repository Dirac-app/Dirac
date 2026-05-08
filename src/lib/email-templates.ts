/**
 * Email Templates / Snippets Library
 * 
 * Stores reusable message templates that can be inserted into compose.
 * Data is persisted in localStorage with optional sync to database.
 */

import { auth } from "@/lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  title: string;
  content: string;
  category: TemplateCategory;
  shortcut?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export type TemplateCategory = 
  | "greeting"
  | "follow_up"
  | "meeting"
  | "thank_you"
  | "intro"
  | "closing"
  | "custom";

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  greeting: "Greeting",
  follow_up: "Follow-up",
  meeting: "Meeting Request",
  thank_you: "Thank You",
  intro: "Introduction",
  closing: "Closing",
  custom: "Custom",
};

// ─── localStorage Keys ─────────────────────────────────────────────────

const TEMPLATES_KEY = "dirac_email_templates";
const TEMPLATE_SYNC_ENABLED_KEY = "dirac_template_sync_enabled";

// ─── Default Templates ───────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt" | "syncedAt">[] = [
  {
    title: "Quick Hello",
    content: "Hi there,\n\nHope you're doing well!\n\nBest,",
    category: "greeting",
    shortcut: "/hello",
  },
  {
    title: "Thanks for Getting in Touch",
    content: "Thank you for reaching out! I appreciate you taking the time to connect.\n\nI'll follow up shortly.\n\nBest,",
    category: "thank_you",
    shortcut: "/thanks",
  },
  {
    title: "Follow Up",
    content: "Hi,\n\nJust following up on our previous conversation. Wanted to check if you had any questions or needed any additional information.\n\nLooking forward to hearing from you.\n\nBest,",
    category: "follow_up",
    shortcut: "/followup",
  },
  {
    title: "Meeting Request",
    content: "Hi,\n\nI'd love to schedule some time to chat. Would you be available for a 30-minute call this week?\n\nLet me know what times work best for you.\n\nBest,",
    category: "meeting",
    shortcut: "/meeting",
  },
  {
    title: "Introduction",
    content: "Hi,\n\nMy name is [Your Name] and I'm [your role] at [your company]. I reached out because [reason for connecting].\n\nI'd love to learn more about [their work/company] and explore potential ways we could work together.\n\nWould you be open to a brief conversation?\n\nBest,",
    category: "intro",
    shortcut: "/intro",
  },
  {
    title: "Looking Forward",
    content: "Looking forward to hearing from you!\n\nBest,",
    category: "closing",
    shortcut: "/lookforward",
  },
];

// ─── LocalStorage Functions ─────────────────────────────────────────────

export function loadTemplates(): EmailTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveTemplates(templates: EmailTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {}
}

export function getTemplateSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TEMPLATE_SYNC_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setTemplateSyncEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEMPLATE_SYNC_ENABLED_KEY, enabled ? "true" : "false");
  } catch {}
}

// ─── Template CRUD ─────────────────────────────────────────────────────

export function createTemplate(
  template: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt" | "syncedAt">
): EmailTemplate {
  const now = new Date().toISOString();
  const newTemplate: EmailTemplate = {
    ...template,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  
  const templates = loadTemplates();
  templates.unshift(newTemplate);
  saveTemplates(templates);
  
  return newTemplate;
}

export function updateTemplate(
  id: string,
  updates: Partial<Pick<EmailTemplate, "title" | "content" | "category" | "shortcut">>
): EmailTemplate | null {
  const templates = loadTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index === -1) return null;
  
  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    syncedAt: undefined, // Mark as needing sync
  };
  
  saveTemplates(templates);
  return templates[index];
}

export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates();
  const filtered = templates.filter(t => t.id !== id);
  
  if (filtered.length === templates.length) return false;
  
  saveTemplates(filtered);
  return true;
}

export function getTemplateByShortcut(shortcut: string): EmailTemplate | null {
  const templates = loadTemplates();
  return templates.find(t => t.shortcut?.toLowerCase() === shortcut.toLowerCase()) || null;
}

// ─── Database Sync Functions ────────────────────────────────────────────

/**
 * Sync templates to the server database.
 * Returns the number of templates synced.
 */
export async function syncTemplatesToDb(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, count: 0, error: "Not authenticated" };
    }

    const templates = loadTemplates();
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates }),
    });

    if (!res.ok) {
      throw new Error("Sync failed");
    }

    const data = await res.json();
    
    // Mark templates as synced
    const now = new Date().toISOString();
    const updatedTemplates = templates.map(t => ({
      ...t,
      syncedAt: t.syncedAt || now,
    }));
    saveTemplates(updatedTemplates);

    return { success: true, count: data.count ?? templates.length };
  } catch (err) {
    return { 
      success: false, 
      count: 0, 
      error: err instanceof Error ? err.message : "Unknown error" 
    };
  }
}

/**
 * Fetch templates from the server database.
 * Returns merged local + server templates.
 */
export async function fetchTemplatesFromDb(): Promise<EmailTemplate[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];

    const res = await fetch("/api/templates");
    if (!res.ok) return [];

    const data = await res.json();
    return data.templates ?? [];
  } catch {
    return [];
  }
}

/**
 * Merge local and server templates.
 * Server version wins for conflicts based on updatedAt.
 */
export function mergeTemplates(local: EmailTemplate[], server: EmailTemplate[]): EmailTemplate[] {
  const merged = new Map<string, EmailTemplate>();
  
  // Add all local templates
  for (const t of local) {
    merged.set(t.id, t);
  }
  
  // Merge server templates (newer wins)
  for (const t of server) {
    const existing = merged.get(t.id);
    if (!existing || new Date(t.updatedAt) > new Date(existing.updatedAt)) {
      merged.set(t.id, t);
    }
  }
  
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ─── Initialize Default Templates ───────────────────────────────────────

export function initializeDefaultTemplates(): void {
  const existing = loadTemplates();
  if (existing.length > 0) return; // Don't overwrite existing
  
  const templates: EmailTemplate[] = DEFAULT_TEMPLATES.map(t => ({
    ...t,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  
  saveTemplates(templates);
}
