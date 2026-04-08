/**
 * User-related helpers — DB-free for MVP.
 * Model resolution delegated to model-config.ts.
 */

import { resolveModel, ALLOWED_MODELS, type ModelTier } from "@/lib/model-config";

export { ALLOWED_MODELS };

export async function getApiKeyForUser(_userId: string): Promise<string | null> {
  return process.env.OPENROUTER_API_KEY ?? null;
}

/**
 * Resolve the model for the chat route (always "standard" tier).
 * The chat route passes the user's stored preset via body.preset.
 */
export async function getModelForUser(
  _userId: string,
  preset?: string | null,
  tier: ModelTier = "standard",
): Promise<string> {
  return resolveModel(tier, preset);
}
