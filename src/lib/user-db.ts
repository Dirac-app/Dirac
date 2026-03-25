/**
 * User-related helpers — DB-free for MVP.
 * Model allowlist, API key resolution, and sanitization.
 */

const DEFAULT_MODEL = "google/gemini-2.0-flash-001";

export const ALLOWED_MODELS = new Set([
  "anthropic/claude-haiku-4-4",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-pro-preview-03-25",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
]);

export function sanitizeModel(model: string | undefined | null): string {
  if (!model) return DEFAULT_MODEL;
  return ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
}

export function getDefaultModel(): string {
  return sanitizeModel(process.env.OPENROUTER_MODEL) || DEFAULT_MODEL;
}

export async function getApiKeyForUser(_userId: string): Promise<string | null> {
  return process.env.OPENROUTER_API_KEY ?? null;
}

export async function getModelForUser(
  _userId: string,
  clientModel?: string,
): Promise<string> {
  if (clientModel) return sanitizeModel(clientModel);
  return getDefaultModel();
}
