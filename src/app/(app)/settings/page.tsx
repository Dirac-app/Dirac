"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  Sparkles,
  User,
  Plus,
  CheckCircle2,
  Loader2,
  Scan,
  Pencil,
  RotateCcw,
  X,
  Monitor,
  Sun,
  Moon,
  Sunrise,
  AtSign,
  Keyboard,
  LayoutGrid,
  Inbox as InboxIcon,
} from "lucide-react";
import {
  type SenderOverride,
  loadSenderOverrides,
  addSenderOverride,
  removeSenderOverride,
  normalizePattern,
  describeOverride,
  SENDER_OVERRIDES_CHANGED_EVENT,
} from "@/lib/sender-overrides";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  type FounderCategory,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppState, TONE_CONTEXT_LABELS } from "@/lib/store";
import type { ToneProfile, ConditionalTone, ToneContext } from "@/lib/store";
import { useThemeConfig } from "@/lib/theme";
import { ThemeSelector } from "@/components/ui/theme-selector";

// ─── Outlook icon (simple SVG) ──────────────────────────

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

// ─── Types ──────────────────────────────────────────────

interface OutlookStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
}

// ─── Page wrapper (Suspense for useSearchParams) ────────

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

// ─── Tone profile section ────────────────────────────────

const FORMALITY_LABELS: Record<string, string> = {
  formal: "Formal",
  "semi-formal": "Semi-formal",
  casual: "Casual",
  "very-casual": "Very casual",
};

// ─── AI Settings Section ─────────────────────────────────

import { PRESET_META, type ModelPreset, FAST_MODEL, STANDARD_MODEL } from "@/lib/model-config";

function MorningBriefingSettingsSection() {
  const [enabled, setEnabled] = useState(true);
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [morningOnly, setMorningOnly] = useState(true);
  const [maxItems, setMaxItems] = useState("5");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dirac_morning_brief_settings");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        enabled?: boolean;
        weekdaysOnly?: boolean;
        morningOnly?: boolean;
        maxItems?: number;
      };
      setEnabled(parsed.enabled ?? true);
      setWeekdaysOnly(parsed.weekdaysOnly ?? false);
      setMorningOnly(parsed.morningOnly ?? true);
      setMaxItems(String(parsed.maxItems ?? 5));
    } catch {}
  }, []);

  const save = useCallback((next: {
    enabled?: boolean;
    weekdaysOnly?: boolean;
    morningOnly?: boolean;
    maxItems?: number;
  }) => {
    try {
      const current = {
        enabled,
        weekdaysOnly,
        morningOnly,
        maxItems: Number(maxItems) || 5,
      };
      localStorage.setItem("dirac_morning_brief_settings", JSON.stringify({ ...current, ...next }));
      window.dispatchEvent(new StorageEvent("storage", { key: "dirac_morning_brief_settings" }));
    } catch {}
  }, [enabled, weekdaysOnly, morningOnly, maxItems]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sunrise className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Morning briefing</h2>
      </div>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Enable morning briefing</div>
            <p className="text-xs text-muted-foreground">Show a proactive daily plan for the most important threads.</p>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); save({ enabled: e.target.checked }); }} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Only show in the morning</div>
            <p className="text-xs text-muted-foreground">Auto-open only before midday. You can still reopen it manually.</p>
          </div>
          <input type="checkbox" checked={morningOnly} onChange={(e) => { setMorningOnly(e.target.checked); save({ morningOnly: e.target.checked }); }} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Weekdays only</div>
            <p className="text-xs text-muted-foreground">Useful if you want the briefing to feel more like a workday ritual.</p>
          </div>
          <input type="checkbox" checked={weekdaysOnly} onChange={(e) => { setWeekdaysOnly(e.target.checked); save({ weekdaysOnly: e.target.checked }); }} />
        </label>
        <div>
          <label className="text-xs text-muted-foreground">Max items in briefing</label>
          <Input
            value={maxItems}
            onChange={(e) => setMaxItems(e.target.value)}
            onBlur={() => save({ maxItems: Math.min(8, Math.max(3, Number(maxItems) || 5)) })}
            className="mt-1 w-24 text-sm"
          />
        </div>
      </div>
    </section>
  );
}

const PRESET_ORDER: ModelPreset[] = ["speed", "balanced", "quality"];

function AiSettingsSection() {
  const [preset,    setPresetState] = useState<ModelPreset>("balanced");
  const [aboutMe,   setAboutMe]     = useState<string>("");
  const [saving,    setSaving]      = useState(false);
  const [saved,     setSaved]       = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [loading,   setLoading]     = useState(true);

  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem("dirac-ai-preset") as ModelPreset | null;
      if (savedPreset && PRESET_ORDER.includes(savedPreset)) setPresetState(savedPreset);
      const savedAbout = localStorage.getItem("dirac-about-me");
      if (savedAbout) setAboutMe(savedAbout);
    } catch {}
    setLoading(false);
  }, []);

  const persist = useCallback((nextPreset: ModelPreset, nextAbout: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      localStorage.setItem("dirac-ai-preset", nextPreset);
      localStorage.setItem("dirac-about-me", nextAbout);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handlePresetSelect = (p: ModelPreset) => {
    setPresetState(p);
    persist(p, aboutMe);
  };

  const handleAboutMeBlur = () => persist(preset, aboutMe);

  const meta = PRESET_META[preset];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">AI settings</h2>
        </div>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {saved && !saving && (
          <span className="flex items-center gap-1 text-[11px] text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        )}
        {saveError && <span className="text-[11px] text-red-500">{saveError}</span>}
      </div>

      <div className="space-y-6">

        {/* Quality preset */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Quality preset</label>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_ORDER.map((p) => {
                  const isSelected = preset === p;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePresetSelect(p)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary/8 dark:bg-primary/10"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className={cn(
                        "h-3 w-3 rounded-full border-2 transition-colors",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
                      )} />
                      <span className={cn(
                        "text-xs font-medium",
                        isSelected ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {PRESET_META[p].label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Description + model detail */}
              <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground/70">Background tasks</span>
                    <span className="font-mono text-foreground/80">{FAST_MODEL.split("/")[1]}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground/70">Drafts &amp; chat</span>
                    <span className="font-mono text-foreground/80">
                      {preset === "speed" ? FAST_MODEL.split("/")[1] : STANDARD_MODEL.split("/")[1]}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* About you */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            About you{" "}
            <span className="font-normal text-muted-foreground/60">— gives AI context when drafting</span>
          </label>
          <Textarea
            value={aboutMe}
            onChange={e => setAboutMe(e.target.value)}
            onBlur={handleAboutMeBlur}
            placeholder="e.g. I'm a product manager at a Series B startup. I mostly email engineers, investors, and customers. Keep it brief."
            className="mt-1.5 text-sm min-h-[72px] resize-none"
            rows={3}
          />
        </div>

      </div>
    </section>
  );
}

// ─── Appearance Section ───────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useAppState();
  const { config, setColorScheme, setDensity: setThemeDensity } = useThemeConfig();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themes = [
    { id: "light",  label: "Light",  icon: Sun  },
    { id: "dark",   label: "Dark",   icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ] as const;

  const densities = [
    { id: "comfortable", label: "Comfortable", desc: "More breathing room between threads" },
    { id: "compact",     label: "Compact",     desc: "Fit more threads on screen" },
  ] as const;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
      </div>

      <div className="space-y-6">
        {/* New Theme Selector with Color Schemes */}
        <ThemeSelector 
          colorScheme={config.colorScheme}
          density={config.density}
          onColorSchemeChange={setColorScheme}
          onDensityChange={setThemeDensity}
        />

        <Separator />

        {/* Legacy Theme (Light/Dark/System) - keeping for compatibility */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Theme Mode</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themes.map(t => {
              const Icon = t.icon;
              const active = mounted && theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition-colors ${
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToneSection() {
  const { toneProfile, setToneProfile } = useAppState();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSummary, setEditSummary] = useState("");

  const handleAutoDetect = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/tone", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setToneProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze tone");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveManual = () => {
    if (!editSummary.trim()) return;
    const profile: ToneProfile = {
      summary: editSummary.trim(),
      formality: "semi-formal",
      traits: [],
      greeting_style: "",
      signoff_style: "",
      example_phrases: [],
    };
    setToneProfile(profile);
    setEditing(false);
  };

  const handleStartEdit = () => {
    setEditSummary(toneProfile?.summary ?? "");
    setEditing(true);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Writing tone
        </h2>
      </div>

      {!toneProfile && !editing ? (
        // No tone set — show setup options
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Dirac matches your writing style when drafting replies. Set your
            tone so AI responses sound like you.
          </p>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleAutoDetect}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scan className="h-3.5 w-3.5" />
              )}
              {analyzing ? "Analyzing emails..." : "Auto-detect from emails"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Describe manually
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      ) : editing ? (
        // Manual editing
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Describe your writing style in a few sentences
            </label>
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="e.g., I write casually but professionally. I keep emails short, use contractions, rarely use exclamation marks, and sign off with just my first name."
              className="mt-1 text-sm min-h-[80px]"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="text-xs"
              onClick={handleSaveManual}
              disabled={!editSummary.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : toneProfile ? (
        // Tone profile display
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <p className="text-sm text-foreground">{toneProfile.summary}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {toneProfile.formality && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {FORMALITY_LABELS[toneProfile.formality] ?? toneProfile.formality}
                </Badge>
              )}
              {toneProfile.traits.map((trait) => (
                <Badge
                  key={trait}
                  variant="secondary"
                  className="text-[10px] font-normal"
                >
                  {trait}
                </Badge>
              ))}
            </div>

            {(toneProfile.greeting_style || toneProfile.signoff_style) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {toneProfile.greeting_style && (
                  <div>
                    <span className="text-muted-foreground">Greeting: </span>
                    <span className="text-foreground">
                      {toneProfile.greeting_style}
                    </span>
                  </div>
                )}
                {toneProfile.signoff_style && (
                  <div>
                    <span className="text-muted-foreground">Sign-off: </span>
                    <span className="text-foreground">
                      {toneProfile.signoff_style}
                    </span>
                  </div>
                )}
              </div>
            )}

            {toneProfile.example_phrases.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">
                  Characteristic phrases:{" "}
                </span>
                <span className="text-foreground italic">
                  {toneProfile.example_phrases
                    .map((p) => `"${p}"`)
                    .join(", ")}
                </span>
              </div>
            )}

            {toneProfile.conditional_tones && toneProfile.conditional_tones.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground">
                  Contextual tone shifts
                </p>
                {toneProfile.conditional_tones.map((ct, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted/40 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {TONE_CONTEXT_LABELS[ct.context as ToneContext] ?? ct.context}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        {FORMALITY_LABELS[ct.formality] ?? ct.formality}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ct.tone}</p>
                    {ct.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ct.traits.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {ct.example_phrases.length > 0 && (
                      <p className="text-[11px] italic text-muted-foreground">
                        {ct.example_phrases.map((p) => `"${p}"`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleAutoDetect}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Re-analyze
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setToneProfile(null)}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ─── Inbox sections settings ─────────────────────────────

import {
  EXTRA_SECTION_LABELS,
  type ExtraSection,
} from "@/components/inbox/thread-list";

const ALL_SECTIONS: ExtraSection[] = ["urgent", "waiting_on", "needs_reply", "done", "snoozed"];
const SECTIONS_LS_KEY_SETTINGS = "dirac-inbox-sections";

const SECTION_DESCRIPTIONS: Record<ExtraSection, string> = {
  urgent:      "Threads you've marked as high priority",
  waiting_on:  "Threads where you've replied and are waiting for a response",
  needs_reply: "Threads the AI has flagged as needing your reply",
  done:        "Threads you've marked as done",
  snoozed:     "Threads you've snoozed for later",
};

function InboxSectionsSection() {
  const [enabled, setEnabled] = useState<ExtraSection[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_LS_KEY_SETTINGS);
      if (saved) setEnabled(JSON.parse(saved));
    } catch {}
  }, []);

  const toggle = (section: ExtraSection) => {
    setEnabled(prev => {
      const next = prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section];
      try { localStorage.setItem(SECTIONS_LS_KEY_SETTINGS, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-foreground">Inbox sections</h2>
      </div>
      <p className="text-xs text-muted-foreground/70 mb-4">
        "New for you" always shows unread threads. Add extra sections below to surface specific thread types at a glance.
      </p>
      <div className="flex flex-col gap-2">
        {ALL_SECTIONS.map(section => (
          <label key={section} className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background transition-colors group-hover:border-primary/50">
              <input
                type="checkbox"
                className="sr-only"
                checked={enabled.includes(section)}
                onChange={() => toggle(section)}
              />
              {enabled.includes(section) && (
                <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{EXTRA_SECTION_LABELS[section]}</p>
              <p className="text-xs text-muted-foreground/60">{SECTION_DESCRIPTIONS[section]}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

// ─── Category tabs settings ─────────────────────────────

function CategoryTabsSection() {
  const { categoryTabs, setCategoryTabs } = useAppState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const toggleVisible = (id: string) => {
    setCategoryTabs(categoryTabs.map(t =>
      t.id === id ? { ...t, visible: !t.visible } : t,
    ));
  };

  const startRename = (tab: { id: string; label: string }) => {
    setEditingId(tab.id);
    setEditLabel(tab.label);
  };

  const saveRename = () => {
    if (!editingId || !editLabel.trim()) { setEditingId(null); return; }
    setCategoryTabs(categoryTabs.map(t =>
      t.id === editingId ? { ...t, label: editLabel.trim() } : t,
    ));
    setEditingId(null);
  };

  const moveTab = (id: string, dir: -1 | 1) => {
    const idx = categoryTabs.findIndex(t => t.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= categoryTabs.length) return;
    const next = [...categoryTabs];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    next.forEach((t, i) => { t.order = i; });
    setCategoryTabs(next);
  };

  const deleteTab = (id: string) => {
    setCategoryTabs(categoryTabs.filter(t => t.id !== id));
  };

  if (categoryTabs.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-foreground">Category tabs</h2>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Category tabs will appear once Dirac categorizes your emails. They&apos;re auto-detected from your inbox patterns.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-foreground">Category tabs</h2>
      </div>
      <p className="text-xs text-muted-foreground/70 mb-4">
        Tabs are auto-detected from your email patterns. Rename, reorder, or hide them.
      </p>
      <div className="flex flex-col gap-1.5">
        {categoryTabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-all",
              !tab.visible && "opacity-40",
            )}
          >
            {/* Visibility toggle */}
            <button
              onClick={() => toggleVisible(tab.id)}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background transition-colors hover:border-primary/50"
            >
              {tab.visible && <div className="h-2.5 w-2.5 rounded-sm bg-primary" />}
            </button>

            {/* Label (editable) */}
            {editingId === tab.id ? (
              <input
                autoFocus
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onBlur={saveRename}
                onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditingId(null); }}
                className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary/30"
              />
            ) : (
              <button
                onClick={() => startRename(tab)}
                className="flex-1 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
                title="Click to rename"
              >
                {tab.label}
              </button>
            )}

            {/* Thread count */}
            <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
              {tab.id}
            </span>

            {/* Reorder */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => moveTab(tab.id, -1)}
                disabled={idx === 0}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <svg className="h-3 w-3" viewBox="0 0 10 10" fill="none"><path d="M2 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                onClick={() => moveTab(tab.id, 1)}
                disabled={idx === categoryTabs.length - 1}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <svg className="h-3 w-3" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={() => deleteTab(tab.id)}
              title="Remove tab"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Sender rules (manual @sender-type overrides) ──────────────────

const OVERRIDE_CATEGORY_ORDER: FounderCategory[] = [
  "team",
  "customer",
  "investor",
  "vendor",
  "recruiter",
  "pr_media",
  "outreach",
  "personal",
  "automated",
];

function SenderOverridesSection() {
  const [overrides, setOverrides] = useState<SenderOverride[]>([]);
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<FounderCategory>("customer");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverrides(loadSenderOverrides());
    const sync = () => setOverrides(loadSenderOverrides());
    window.addEventListener(SENDER_OVERRIDES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SENDER_OVERRIDES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleAdd = () => {
    setError(null);
    const norm = normalizePattern(pattern);
    if (!norm) {
      setError("Enter a valid email (sam@acme.com) or domain (@acme.com).");
      return;
    }
    const added = addSenderOverride(pattern, category);
    if (!added) {
      setError("Couldn't save that rule.");
      return;
    }
    setOverrides(loadSenderOverrides());
    setPattern("");
  };

  const handleRemove = (id: string) => {
    removeSenderOverride(id);
    setOverrides(loadSenderOverrides());
  };

  return (
    <section id="sender-rules">
      <div className="flex items-center gap-2 mb-1">
        <AtSign className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Sender rules</h2>
      </div>
      <p className="text-xs text-muted-foreground/70 mb-4">
        Pin a specific email or whole domain to a sender type. Rules beat the AI
        classifier — what you set here is what shows on the thread card. Leave
        empty and Dirac decides automatically.
      </p>

      {/* Existing rules */}
      {overrides.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {overrides.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
            >
              <span className="font-mono text-[12px] text-foreground/90 truncate flex-1 min-w-0">
                {describeOverride(r)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 font-serif italic text-[11px] whitespace-nowrap",
                  FOUNDER_CATEGORY_COLORS[r.category],
                )}
              >
                <span className="opacity-40 not-italic font-sans">@</span>
                {FOUNDER_CATEGORY_LABELS[r.category]}
              </span>
              <button
                onClick={() => handleRemove(r.id)}
                title="Remove rule"
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add-new row */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Input
            value={pattern}
            onChange={(e) => { setPattern(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder="sam@acme.com  or  @acme.com"
            className="text-sm font-mono flex-1"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FounderCategory)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {OVERRIDE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {FOUNDER_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!pattern.trim()}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <p className="text-[11px] text-muted-foreground/60">
          Email rules win over domain rules. Longer domains beat shorter ones
          (so <span className="font-mono">mail.acme.com</span> is more specific
          than <span className="font-mono">acme.com</span>).
        </p>
      </div>
    </section>
  );
}

// ─── Settings navigation (Google-Docs-style left TOC) ───

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "profile",          label: "Profile",           icon: User },
  { id: "accounts",         label: "Email accounts",    icon: Mail },
  { id: "appearance",       label: "Appearance",        icon: Monitor },
  { id: "tone",             label: "Writing tone",      icon: Sparkles },
  { id: "ai",               label: "AI settings",       icon: Sparkles },
  { id: "morning-briefing", label: "Morning briefing",  icon: Sunrise },
  { id: "sender-rules",     label: "Sender rules",      icon: AtSign },
  { id: "inbox-sections",   label: "Inbox sections",    icon: InboxIcon },
  { id: "category-tabs",    label: "Category tabs",     icon: LayoutGrid },
  { id: "shortcuts",        label: "Keyboard shortcuts", icon: Keyboard },
  { id: "onboarding",       label: "Onboarding",        icon: Sparkles },
];

function SettingsNav({
  activeId,
  scrollTo,
}: {
  activeId: string;
  scrollTo: (id: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5 text-[13px]">
      {SETTINGS_SECTIONS.map((s) => {
        const Icon = s.icon;
        const active = activeId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
              active
                ? "bg-accent/70 text-foreground"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-colors",
                active ? "text-foreground" : "text-muted-foreground/60",
              )}
            />
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Settings content ───────────────────────────────────

function SettingsContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isLoading = status === "loading";
  const gmailConnected = session?.gmailConnected ?? false;

  // TOC active-section tracking. We observe every section with a known id and
  // pick whichever one is closest to the top of the scroll container.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    SETTINGS_SECTIONS[0]?.id ?? "",
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Manual scroll-driven active tracking. IntersectionObserver on a nested
    // scroll container can be flaky across browsers, so this hand-rolled
    // "closest-to-top" check is more predictable.
    const updateActive = () => {
      const containerTop = container.getBoundingClientRect().top;
      // Offset slightly so a section becomes "active" once it's near the top,
      // not strictly once its top crosses the viewport edge.
      const threshold = containerTop + 80;
      let bestId = SETTINGS_SECTIONS[0]?.id ?? "";
      let bestDelta = Number.NEGATIVE_INFINITY;
      for (const s of SETTINGS_SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        const delta = top - threshold;
        // Pick the section whose top is just above the threshold (delta ≤ 0
        // and as close to 0 as possible).
        if (delta <= 0 && delta > bestDelta) {
          bestDelta = delta;
          bestId = s.id;
        }
      }
      setActiveSectionId((prev) => (prev === bestId ? prev : bestId));
    };

    updateActive();
    container.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      container.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    const container = scrollContainerRef.current;
    if (!el || !container) return;
    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    // scrollBy keeps it relative to the current scroll position — avoids
    // off-by-one bugs compared to element.scrollIntoView inside a scroll container.
    container.scrollBy({
      top: elTop - containerTop - 12,
      behavior: "smooth",
    });
    // Optimistically mark active; the scroll listener will correct if wrong.
    setActiveSectionId(id);
  }, []);

  // Outlook state
  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus>({
    connected: false,
  });
  const [outlookLoading, setOutlookLoading] = useState(true);

  const fetchOutlookStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/outlook/status");
      if (res.ok) {
        const data = await res.json();
        setOutlookStatus(data);
      }
    } catch {
      setOutlookStatus({ connected: false });
    } finally {
      setOutlookLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlookStatus();
  }, [fetchOutlookStatus]);

  // Check for outlook=connected query param
  useEffect(() => {
    if (searchParams.get("outlook") === "connected") {
      fetchOutlookStatus();
    }
  }, [searchParams, fetchOutlookStatus]);

  // ─── Handlers ─────────────────────────────────────────

  const handleGmailConnect = () => {
    signIn("google", { callbackUrl: "/settings" });
  };

  const handleGmailDisconnect = () => {
    signOut({ callbackUrl: "/settings" });
  };

  const handleOutlookConnect = () => {
    window.location.href = "/api/oauth/outlook";
  };

  const handleOutlookDisconnect = async () => {
    setOutlookLoading(true);
    try {
      await fetch("/api/outlook/status", { method: "DELETE" });
      setOutlookStatus({ connected: false });
    } catch {
      // ignore
    } finally {
      setOutlookLoading(false);
    }
  };

  // ─── Connector definitions ────────────────────────────

  const connectors = [
    {
      platform: "Gmail",
      icon: Mail,
      connected: gmailConnected,
      connectedDetail: gmailConnected ? session?.user?.email : undefined,
      description: "Google email — read, reply, and send",
      comingSoon: false,
    },
    {
      platform: "Outlook",
      icon: OutlookIcon,
      connected: outlookStatus.connected,
      connectedDetail: outlookStatus.connected
        ? outlookStatus.email
        : undefined,
      description: "Microsoft 365, Outlook.com, Hotmail",
      comingSoon: false,
    },
  ];

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-4xl gap-10 px-6 py-6">
          {/* Left TOC — hidden on narrow screens; sticky on md+ */}
          <aside className="hidden md:block sticky top-6 w-48 shrink-0 self-start">
            <SettingsNav activeId={activeSectionId} scrollTo={scrollToSection} />
          </aside>

          {/* Right content — same width cap as before so existing sections lay out identically */}
          <div className="flex-1 min-w-0 max-w-xl space-y-8">
        {/* Profile */}
        <section id="profile">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                defaultValue={session?.user?.name ?? ""}
                placeholder="Your name"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                value={session?.user?.email ?? ""}
                className="mt-1 text-sm"
                disabled
                placeholder="Connect an email to populate"
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* Connected accounts */}
        <section id="accounts">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Email accounts
            </h2>
          </div>
          <div className="space-y-3">
            {connectors.map((c) => (
              <div
                key={c.platform}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.platform}
                      </span>
                      {c.comingSoon && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          Coming soon
                        </Badge>
                      )}
                      {c.connected && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] font-normal text-green-600"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.connected && c.connectedDetail
                        ? c.connectedDetail
                        : c.description}
                    </p>
                  </div>
                </div>

                {c.platform === "Gmail" ? (
                  <Button
                    variant={c.connected ? "outline" : "default"}
                    size="sm"
                    className="text-xs"
                    onClick={
                      c.connected ? handleGmailDisconnect : handleGmailConnect
                    }
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : c.connected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : c.platform === "Outlook" ? (
                  <Button
                    variant={outlookStatus.connected ? "outline" : "default"}
                    size="sm"
                    className="text-xs"
                    onClick={
                      outlookStatus.connected
                        ? handleOutlookDisconnect
                        : handleOutlookConnect
                    }
                    disabled={outlookLoading}
                  >
                    {outlookLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : outlookStatus.connected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs"
                    disabled={c.comingSoon}
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Connection guidance */}
          {!gmailConnected && !outlookStatus.connected && (
            <p className="mt-3 text-xs text-muted-foreground/60">
              Connect at least one email account to start using Dirac.
            </p>
          )}
          {gmailConnected && outlookStatus.connected && (
            <p className="mt-3 text-xs text-muted-foreground/60">
              Both accounts synced. All emails appear in a unified inbox.
            </p>
          )}
        </section>

        <Separator />

        {/* Appearance */}
        <div id="appearance"><AppearanceSection /></div>

        <Separator />

        {/* AI preferences — Tone */}
        <div id="tone"><ToneSection /></div>

        <Separator />

        {/* Other AI settings */}
        <div id="ai"><AiSettingsSection /></div>

        <Separator />

        <div id="morning-briefing"><MorningBriefingSettingsSection /></div>

        <Separator />

        {/* Sender rules — manual @sender-type overrides */}
        <SenderOverridesSection />

        <Separator />

        {/* Inbox sections */}
        <div id="inbox-sections"><InboxSectionsSection /></div>

        <Separator />

        {/* Category tabs */}
        <div id="category-tabs"><CategoryTabsSection /></div>

        <Separator />

        {/* Re-run onboarding */}
        <section id="onboarding">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Onboarding</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Re-run the welcome flow. Useful if you skipped a step or want to revisit your tone & persona choices.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                window.localStorage.removeItem("dirac_onboarding_complete");
                window.localStorage.removeItem("dirac_onboarding_progress");
                window.location.reload();
              } catch {}
            }}
          >
            Restart onboarding
          </Button>
        </section>

        <Separator />

        {/* Keyboard shortcuts */}
        <section id="shortcuts">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          </div>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border text-xs">
            {[
              ["?",          "Show shortcuts"],
              ["Cmd/Ctrl K", "Open command palette"],
              ["R",          "Reply to selected thread"],
              ["E",          "Archive thread"],
              ["#",          "Delete thread"],
              ["U",          "Mark unread"],
              ["S",          "Star / unstar"],
              ["G I",        "Go to inbox"],
              ["G A",        "Go to activity"],
              ["G S",        "Go to settings"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <kbd className="font-mono text-[10px] bg-muted border border-border rounded px-1.5 py-0.5">{key}</kbd>
              </div>
            ))}
          </div>
        </section>

          </div>
        </div>
      </div>
    </div>
  );
}
