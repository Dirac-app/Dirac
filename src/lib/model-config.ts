/**
 * Model tier and preset resolution for Dirac.
 *
 * Two tiers:
 *   - "fast"     → cheap, low-latency models for background / high-volume tasks
 *   - "standard" → higher-quality models for anything the user will send or read carefully
 *
 * Three user-facing presets (stored in localStorage as "dirac-ai-preset"):
 *   - "speed"    → fast model for everything
 *   - "balanced" → fast for background, standard for compose/send  (default)
 *   - "quality"  → standard model for everything
 */

export type ModelTier   = "fast" | "standard";
export type ModelPreset = "speed" | "balanced" | "quality";

export const FAST_MODEL     = "google/gemini-2.5-flash";
export const STANDARD_MODEL = "anthropic/claude-sonnet-4-5";

export const DEFAULT_PRESET: ModelPreset = "balanced";

/**
 * Resolve the actual OpenRouter model ID to use.
 *
 * Fast-tier tasks (background, triage, summaries) are ALWAYS fast —
 * the preset only controls quality for standard-tier (compose/send) tasks.
 *
 * @param tier    - The task tier ("fast" or "standard")
 * @param preset  - The user's quality preset (default: "balanced")
 */
export function resolveModel(tier: ModelTier, preset?: string | null): string {
  // Background/fast tasks are always fast regardless of preset
  if (tier === "fast") return FAST_MODEL;

  // Standard/compose tasks: speed preset downgrades to fast, otherwise standard
  const p = (preset ?? DEFAULT_PRESET) as ModelPreset;
  if (p === "speed") return FAST_MODEL;
  return STANDARD_MODEL;
}

/**
 * All allowed model IDs (for server-side validation if needed).
 */
export const ALLOWED_MODELS = new Set([FAST_MODEL, STANDARD_MODEL]);

export const PRESET_META: Record<ModelPreset, {
  label:       string;
  description: string;
}> = {
  speed: {
    label:       "Speed",
    description: "Uses a fast model for drafts and chat. Fastest across the board.",
  },
  balanced: {
    label:       "Balanced",
    description: "Fast for triage & summaries. Higher quality for drafts and chat.",
  },
  quality: {
    label:       "Quality",
    description: "Best output for drafts and chat. Background tasks stay fast.",
  },
};
