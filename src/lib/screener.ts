// Screener — a block-list of senders whose emails are flagged and hidden
// from the main inbox. Stored in localStorage; dispatches a custom event so
// all consumers stay in sync without a full page reload.

export const SCREENER_LS_KEY = "dirac-screened-senders";
export const SCREENER_CHANGED_EVENT = "dirac:screened-senders-changed";

export interface ScreenedSender {
  id: string;
  email: string;           // full address, lowercase
  name: string;            // display name at the time of screening
  domain: string;          // e.g. "acme.com"
  screenedAt: string;      // ISO timestamp
}

function genId(): string {
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadScreenedSenders(): ScreenedSender[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCREENER_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ScreenedSender =>
        !!r &&
        typeof r === "object" &&
        typeof (r as ScreenedSender).id === "string" &&
        typeof (r as ScreenedSender).email === "string",
    );
  } catch {
    return [];
  }
}

export function saveScreenedSenders(list: ScreenedSender[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCREENER_LS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(SCREENER_CHANGED_EVENT));
  } catch {}
}

export function addScreenedSender(email: string, name: string): ScreenedSender {
  const addr = email.trim().toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  const entry: ScreenedSender = {
    id: genId(),
    email: addr,
    name: name.trim() || addr,
    domain,
    screenedAt: new Date().toISOString(),
  };
  const current = loadScreenedSenders();
  // De-dupe on email — latest wins
  const deduped = current.filter((r) => r.email !== addr);
  saveScreenedSenders([...deduped, entry]);
  return entry;
}

export function removeScreenedSender(id: string): void {
  saveScreenedSenders(loadScreenedSenders().filter((r) => r.id !== id));
}

export function unscreenByEmail(email: string): void {
  const addr = email.trim().toLowerCase();
  saveScreenedSenders(loadScreenedSenders().filter((r) => r.email !== addr));
}

export function isScreened(email: string): boolean {
  const addr = email.trim().toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  return loadScreenedSenders().some(
    (r) => r.email === addr || r.domain === domain,
  );
}
