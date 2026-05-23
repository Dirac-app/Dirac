/**
 * Shared AI response parser.
 * Extracted from ai-sidebar.tsx so it can be reused in any component
 * that receives streaming AI content with fenced code blocks.
 *
 * Supported fence types:
 *   ```mcq     — multiple-choice question JSON
 *   ```draft   — plain text email draft
 *   ```compose — compose-window prefill JSON { to, subject, body }
 *   ```actions — array of thread action objects
 *   ```results — array of search/filter result objects
 *
 * Any text between fences is returned as a "text" segment.
 * Incomplete trailing fences (common while streaming) become "pending" segments
 * so raw JSON never flashes in the UI.
 */

// ─── Types (re-exported so callers don't need to re-declare) ──

export interface McqQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ComposeData {
  to: string;
  subject: string;
  body: string;
}

export interface ActionItem {
  threadId: string;
  action:
    | "star"
    | "unstar"
    | "mark_read"
    | "mark_unread"
    | "mark_urgent"
    | "remove_urgent"
    | "archive"
    | "trash";
  subject: string;
}

export interface ResultItem {
  threadId: string;
  subject: string;
  from: string;
  reason: string;
  triage?: string;
  isUrgent?: boolean;
}

export type StructuredBlockType = "mcq" | "draft" | "compose" | "actions" | "results";

export interface ParsedSegment {
  type: "text" | "pending" | "mcq" | "draft" | "compose" | "actions" | "results";
  content: string;
  mcq?: McqQuestion[];
  compose?: ComposeData;
  actions?: ActionItem[];
  results?: ResultItem[];
  /** Set on pending segments — which block is still streaming in */
  pendingType?: StructuredBlockType;
}

/** Strip an unclosed ``` fence at the end of the buffer (streaming artifact). */
function stripIncompleteTrailingFence(raw: string): {
  cleaned: string;
  pending?: StructuredBlockType;
} {
  const lastFenceStart = raw.lastIndexOf("```");
  if (lastFenceStart === -1) return { cleaned: raw };

  const tail = raw.slice(lastFenceStart);
  const openMatch = tail.match(
    /^```(mcq|draft|compose|actions|results)\r?\n([\s\S]*)$/,
  );
  if (!openMatch) return { cleaned: raw };

  const body = openMatch[2];
  // Closing fence already present in the tail → not an incomplete open at EOF
  if (/\n```\s*$/.test(body) || body.includes("\n```\n")) {
    return { cleaned: raw };
  }

  return {
    cleaned: raw.slice(0, lastFenceStart).trimEnd(),
    pending: openMatch[1] as StructuredBlockType,
  };
}

/** JSON body that failed parse but is clearly a structured block, not prose. */
function looksLikeStructuredJson(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  if (!(t.startsWith("[") || t.startsWith("{"))) return false;
  // Heuristic: structured blocks use quoted keys / arrays
  return t.includes('"') || t.length < 24;
}

// ─── Parser ──────────────────────────────────────────────

export function parseAiContent(raw: string): ParsedSegment[] {
  const { cleaned, pending } = stripIncompleteTrailingFence(raw);
  const segments: ParsedSegment[] = [];
  const fenceRegex = /```(mcq|draft|compose|actions|results)\r?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      const text = cleaned.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: "text", content: text });
    }

    const fenceType = match[1] as StructuredBlockType;
    const fenceBody = match[2].trim();

    switch (fenceType) {
      case "mcq": {
        try {
          const parsed: McqQuestion[] = JSON.parse(fenceBody);
          segments.push({ type: "mcq", content: fenceBody, mcq: parsed });
        } catch {
          if (looksLikeStructuredJson(fenceBody)) {
            segments.push({ type: "pending", content: "", pendingType: "mcq" });
          } else {
            segments.push({ type: "text", content: fenceBody });
          }
        }
        break;
      }
      case "compose": {
        try {
          const parsed: ComposeData = JSON.parse(fenceBody);
          segments.push({ type: "compose", content: fenceBody, compose: parsed });
        } catch {
          if (looksLikeStructuredJson(fenceBody)) {
            segments.push({ type: "pending", content: "", pendingType: "compose" });
          } else {
            segments.push({ type: "text", content: fenceBody });
          }
        }
        break;
      }
      case "actions": {
        try {
          const parsed: ActionItem[] = JSON.parse(fenceBody);
          segments.push({ type: "actions", content: fenceBody, actions: parsed });
        } catch {
          if (looksLikeStructuredJson(fenceBody)) {
            segments.push({ type: "pending", content: "", pendingType: "actions" });
          } else {
            segments.push({ type: "text", content: fenceBody });
          }
        }
        break;
      }
      case "results": {
        try {
          const parsed: ResultItem[] = JSON.parse(fenceBody);
          segments.push({ type: "results", content: fenceBody, results: parsed });
        } catch {
          if (looksLikeStructuredJson(fenceBody)) {
            segments.push({ type: "pending", content: "", pendingType: "results" });
          } else {
            segments.push({ type: "text", content: fenceBody });
          }
        }
        break;
      }
      default: {
        segments.push({ type: "draft", content: fenceBody });
        break;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < cleaned.length) {
    const text = cleaned.slice(lastIndex).trim();
    if (text) segments.push({ type: "text", content: text });
  }

  if (pending) {
    segments.push({ type: "pending", content: "", pendingType: pending });
  }

  if (segments.length === 0 && raw.trim()) {
    // Entire buffer is one incomplete fence with no leading prose
    if (pending) {
      segments.push({ type: "pending", content: "", pendingType: pending });
    } else {
      segments.push({ type: "text", content: raw.trim() });
    }
  }

  return segments;
}

export const PENDING_BLOCK_LABELS: Record<StructuredBlockType, string> = {
  mcq: "Preparing questions…",
  draft: "Drafting…",
  compose: "Preparing email…",
  actions: "Preparing actions…",
  results: "Finding threads…",
};
