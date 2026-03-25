/**
 * Outlook token helper — stubbed for MVP (no persistent DB).
 * Outlook OAuth tokens are not persisted without a database,
 * so Outlook connection requires a DB to function fully.
 */

export async function getOutlookAccessToken(_userId: string): Promise<string | null> {
  return null;
}
