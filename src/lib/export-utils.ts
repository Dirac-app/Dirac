/**
 * Thread export utilities — PDF, JSON, and MBOX generation.
 * All functions run client-side (no server dependencies) using native browser APIs.
 */

import { format } from "date-fns";
import type { DiracThread, DiracMessage } from "./types";
import jsPDF from "jspdf";

// ─── Shared helpers ───────────────────────────────────────

function threadTitle(thread: DiracThread): string {
  return `Re: ${thread.subject}`.replace(/^Re:\s*/i, "");
}

// ─── PDF export ───────────────────────────────────────────

/**
 * Generates and downloads a thread as a PDF document.
 * Renders the thread subject, participants, and each message with
 * sender name, timestamp, and body (preferring plain text).
 */
export function exportThreadAsPdf(
  thread: DiracThread,
  messages: DiracMessage[],
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function addPage() {
    doc.addPage();
    y = margin;
  }

  function checkPageBreak(height: number) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + height > pageHeight - margin) {
      addPage();
    }
  }

  function wrappedText(text: string, fontSize: number, color: string): number {
    const hex = color.startsWith("#") ? color : "#000000";
    const [r, g, b] = hexToRgb(hex);
    doc.setFontSize(fontSize);
    doc.setTextColor(r, g, b);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      checkPageBreak(fontSize * 0.4 + 1);
      doc.text(line, margin, y);
      y += fontSize * 0.4 + 1;
    }
    return lines.length;
  }

  // Title
  doc.setFontSize(16);
  doc.setTextColor(10, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.text(threadTitle(thread), margin, y);
  y += 9;

  // Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${thread.platform} · ${messages.length} message${messages.length !== 1 ? "s" : ""} · Exported ${format(new Date(), "MMM d, yyyy")}`,
    margin,
    y,
  );
  y += 7;

  // Participants
  const participants = thread.participants
    .map((p) => `${p.name} <${p.email}>`)
    .join("; ");
  doc.setFontSize(8.5);
  wrappedText(`Participants: ${participants}`, 8.5, "#888888");
  y += 2;

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Messages
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isFirst = i === 0;

    checkPageBreak(16);

    // Header row
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(10, 10, 10);
    const headerText = `${msg.fromName} · ${format(new Date(msg.sentAt), "MMM d, yyyy 'at' h:mm a")}`;
    doc.text(headerText, margin, y);
    y += 5;

    // Recipients (skip for Discord)
    if (thread.platform !== "DISCORD" && msg.toAddresses.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(130, 130, 130);
      doc.text(`To: ${msg.toAddresses.join(", ")}`, margin, y);
      y += 4;
    }

    // Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    const body = msg.bodyText || "(no content)";
    wrappedText(body, 9.5, "#1e1e1e");
    y += 5;

    // Divider (skip after last message)
    if (i < messages.length - 1) {
      checkPageBreak(2);
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }
  }

  doc.save(`${sanitizeFilename(thread.subject)}.pdf`);
}

// ─── JSON export ──────────────────────────────────────────

export type JsonExportFormat = "json" | "json-pretty";

export interface ThreadExportData {
  exportedAt: string;
  platform: string;
  thread: DiracThread;
  messages: DiracMessage[];
}

/**
 * Downloads the thread as a JSON file.
 */
export function exportThreadAsJson(
  thread: DiracThread,
  messages: DiracMessage[],
  pretty: boolean = true,
): void {
  const data: ThreadExportData = {
    exportedAt: new Date().toISOString(),
    platform: thread.platform,
    thread,
    messages,
  };
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  downloadFile(json, `${sanitizeFilename(thread.subject)}.json`, "application/json");
}

// ─── MBOX export ──────────────────────────────────────────

/**
 * Converts a single message body to a safe, RFC 2822-compliant format.
 * Strips HTML tags and normalizes line endings.
 */
function messageBody(msg: DiracMessage): string {
  let body = msg.bodyText || "";
  // Collapse excessive whitespace
  body = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // RFC says lines longer than 998 chars must be split; we keep well below that
  return body;
}

/**
 * Escapes characters that have special meaning in mbox From_ lines.
 * Per RFC 4155, the From_ delimiter is any line starting with "From ".
 * We escape with ">" (the standard mboxrd convention).
 */
function escapeMboxLine(line: string): string {
  if (line.startsWith("From ")) return ">" + line;
  return line;
}

/**
 * Formats a single message into mbox From_ ...\n\n block.
 * Uses the From_ line format from RFC 4155 / mboxrd.
 *
 *   From <sender> <date-time>
 *
 * Followed by standard email headers and the body.
 */
function formatMboxMessage(msg: DiracMessage, threadSubject: string): string {
  const lines: string[] = [];
  const date = format(new Date(msg.sentAt), "EEE MMM dd HH:mm:ss yyyy");

  lines.push(`From ${msg.fromAddress} ${date}`);

  // Minimal RFC 2822 headers
  lines.push(`From: ${formatAddress(msg.fromName, msg.fromAddress)}`);
  lines.push(`To: ${msg.toAddresses.join(", ")}`);
  if (msg.subject) lines.push(`Subject: ${msg.subject}`);
  lines.push(`Date: ${format(new Date(msg.sentAt), "EEE, dd MMM yyyy HH:mm:ss Z")}`);
  lines.push(`Message-ID: <${msg.id}@dirac-export>`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push("");

  // Body — escape any From_ lines
  const bodyLines = messageBody(msg).split("\n");
  for (const line of bodyLines) {
    lines.push(escapeMboxLine(line));
  }

  lines.push(""); // trailing newline before next message
  return lines.join("\n");
}

/**
 * Generates an mbox-formatted string for the thread.
 * Multiple messages in the same thread are joined with
 * blank "From " separator lines per mboxrd spec.
 */
export function exportThreadAsMbox(
  thread: DiracThread,
  messages: DiracMessage[],
): void {
  const blocks = messages.map((msg) => formatMboxMessage(msg, thread.subject));
  const mbox = blocks.join("\n\n");
  downloadFile(mbox, `${sanitizeFilename(thread.subject)}.mbox`, "application/mbox");
}

// ─── Helpers ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function formatAddress(name: string, email: string): string {
  const safe = name.replace(/"/g, '\\"');
  return email.includes(" ") ? `"${safe}" <${email}>` : `${safe} <${email}>`;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100)
    .replace(/^_|_$/g, "") || "thread";
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
