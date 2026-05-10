"use client";

import { motion } from "framer-motion";
import {
  Briefcase,
  Terminal,
  MessageSquare,
  BellRing,
  Calendar,
  Lock,
  Eye,
  Shield,
  KeyRound,
  Sparkles,
  Sun,
  Mail,
  Inbox,
  Check,
  type LucideIcon,
} from "lucide-react";

// Real gear polygon — alternates outer/inner radius to form teeth
function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / (teeth * 2);
  const pts = Array.from({ length: teeth * 2 }, (_, i) => {
    const a = i * step - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}
import { cn } from "@/lib/utils";

// ─── Visual Placeholder ─────────────────────────────────────────────────────
//
// Each slot is a standalone React component — HTML + Tailwind + Lucide icons.
// Style: white-on-dark, flat 2D, no gradients, no 3D, no gloss.

// ─── slot-welcome — Inbox + AI sidebar wireframe ──────────────────────────
// Screen 2: "See it in 45 seconds"
function WelcomeVisual() {
  const threads = [
    { initials: "LA", subject: "Q2 board update", preview: "Lisa is asking for…", unread: true, active: false },
    { initials: "AR", subject: "Series A follow-up", preview: "Thoughts on the deck…", unread: true, active: true },
    { initials: "LN", subject: "hi@linear.app", preview: "Your weekly digest…", unread: false, active: false },
    { initials: "NT", subject: "noreply@notion", preview: "New comment on…", unread: false, active: false },
  ];
  const draftWords = ["Hi Lisa — here's the Q2 update.", "Revenue tracked +18% MoM,", "two key hires landed."];

  return (
    <div className="flex h-full w-full gap-2 text-white">
      {/* Thread list */}
      <div className="flex w-[42%] flex-col gap-0 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/8">
          <Inbox className="h-3 w-3 text-white/50" />
          <span className="text-[10px] font-medium text-white/50 tracking-wider uppercase">Inbox</span>
        </div>
        {threads.map((t, i) => (
          <div key={i} className={cn(
            "flex items-start gap-2 px-2.5 py-2 border-b border-white/[0.05] last:border-0",
            t.active && "bg-white/8",
          )}>
            <div className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold mt-0.5",
              t.unread ? "bg-white/20 text-white/80" : "bg-white/8 text-white/35",
            )}>
              {t.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[9px] truncate", t.unread ? "text-white/80 font-medium" : "text-white/35")}>
                {t.subject}
              </p>
              <p className="text-[8px] text-white/25 truncate mt-0.5">{t.preview}</p>
            </div>
            {t.unread && <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Right column: thread + AI sidebar */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Thread preview */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex-[0.45]">
          <div className="h-3 w-3/4 rounded-full bg-white/35 mb-1.5" />
          <div className="h-2 w-1/3 rounded-full bg-white/18 mb-3" />
          {[1, 0.85, 0.92, 0.6].map((w, i) => (
            <div key={i} className="h-2 rounded-full bg-white/14 mb-1.5" style={{ width: `${w * 100}%` }} />
          ))}
        </div>

        {/* AI sidebar */}
        <div className="rounded-lg border border-white/18 bg-white/[0.06] p-3 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="h-3 w-3 text-white/60" />
            <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">Dirac · drafting</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {draftWords.map((_, i) => (
              <motion.div key={i}
                className="h-2.5 rounded-full bg-white/22"
                style={{ width: `${[95, 82, 60][i]}%`, transformOrigin: "left" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4 + i * 0.22, duration: 0.5, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="inline-block h-3 w-0.5 rounded-full bg-white/70 ml-1"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.85, repeat: Infinity }}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <div className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2.5 py-1">
              <Mail className="h-2.5 w-2.5 text-white/60" />
              <span className="text-[8px] text-white/55">Send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── slot-persona — 3 large role symbols, no text ────────────────────────
// Screen 3: "Who are you?"
function PersonaVisual() {
  const icons: LucideIcon[] = [Briefcase, Terminal, MessageSquare];

  return (
    <div className="flex h-full w-full items-center justify-around px-4">
      {icons.map((Icon, i) => (
        <motion.div key={i}
          className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/14 bg-white/[0.07]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon className="h-12 w-12 text-white/50" strokeWidth={1.25} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── slot-connect — Real interlocking gear SVG ────────────────────────────
// Screen 5: "Connect your inbox"
function ConnectVisual() {
  // Gear centers chosen so teeth visually mesh (centre distance ≈ R1+R2)
  const big   = { cx: 108, cy: 210, outer: 68, inner: 52, teeth: 12 };
  const small = { cx: 212, cy: 148, outer: 44, inner: 33, teeth:  8 };
  const tiny  = { cx: 220, cy: 302, outer: 32, inner: 24, teeth:  6 };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 300 420" fill="none" className="w-full h-full" aria-hidden>
        {/* Big gear */}
        <motion.g style={{ transformOrigin: `${big.cx}px ${big.cy}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <path d={gearPath(big.cx, big.cy, big.outer, big.inner, big.teeth)}
            fill="white" fillOpacity=".08" stroke="white" strokeOpacity=".3" strokeWidth="1" />
          <circle cx={big.cx} cy={big.cy} r="18"
            fill="white" fillOpacity=".06" stroke="white" strokeOpacity=".22" strokeWidth="1" />
          <circle cx={big.cx} cy={big.cy} r="5" fill="white" fillOpacity=".35" />
        </motion.g>

        {/* Small gear — counter-rotates, ratio = big.teeth/small.teeth */}
        <motion.g style={{ transformOrigin: `${small.cx}px ${small.cy}px` }}
          animate={{ rotate: -360 }}
          transition={{ duration: 10 * small.teeth / big.teeth, repeat: Infinity, ease: "linear" }}
        >
          <path d={gearPath(small.cx, small.cy, small.outer, small.inner, small.teeth)}
            fill="white" fillOpacity=".07" stroke="white" strokeOpacity=".24" strokeWidth=".75" />
          <circle cx={small.cx} cy={small.cy} r="11"
            fill="white" fillOpacity=".05" stroke="white" strokeOpacity=".18" strokeWidth=".75" />
          <circle cx={small.cx} cy={small.cy} r="3.5" fill="white" fillOpacity=".3" />
        </motion.g>

        {/* Tiny gear */}
        <motion.g style={{ transformOrigin: `${tiny.cx}px ${tiny.cy}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 10 * tiny.teeth / big.teeth, repeat: Infinity, ease: "linear" }}
        >
          <path d={gearPath(tiny.cx, tiny.cy, tiny.outer, tiny.inner, tiny.teeth)}
            fill="white" fillOpacity=".06" stroke="white" strokeOpacity=".18" strokeWidth=".75" />
          <circle cx={tiny.cx} cy={tiny.cy} r="8"
            fill="white" fillOpacity=".04" stroke="white" strokeOpacity=".14" strokeWidth=".75" />
          <circle cx={tiny.cx} cy={tiny.cy} r="2.5" fill="white" fillOpacity=".25" />
        </motion.g>
      </svg>
    </div>
  );
}

// ─── slot-problems — Overflowing inbox visualization ──────────────────────
// Screen 6: "What's slowing you down?"
// A flood of email envelopes cascading down — too many to handle.
function ProblemsVisual() {
  const envelopes = [
    { x: 28,  y: 30,  rotate: -12, scale: 0.9, opacity: 0.22, delay: 0.05 },
    { x: 155, y: 18,  rotate:   8, scale: 0.8, opacity: 0.18, delay: 0.10 },
    { x: 220, y: 45,  rotate: -5,  scale: 0.75,opacity: 0.16, delay: 0.14 },
    { x: 60,  y: 90,  rotate:  6,  scale: 1.0, opacity: 0.28, delay: 0.18 },
    { x: 185, y: 105, rotate: -9,  scale: 0.9, opacity: 0.24, delay: 0.22 },
    { x: 20,  y: 170, rotate:  3,  scale: 1.1, opacity: 0.32, delay: 0.26 },
    { x: 120, y: 160, rotate: -7,  scale: 1.0, opacity: 0.35, delay: 0.30 },
    { x: 230, y: 178, rotate:  11, scale: 0.85,opacity: 0.26, delay: 0.34 },
    { x: 55,  y: 255, rotate: -4,  scale: 1.15,opacity: 0.38, delay: 0.38 },
    { x: 175, y: 248, rotate:  7,  scale: 1.0, opacity: 0.32, delay: 0.42 },
    { x: 100, y: 330, rotate: -10, scale: 1.2, opacity: 0.42, delay: 0.46 },
    { x: 210, y: 320, rotate:  5,  scale: 1.05,opacity: 0.36, delay: 0.50 },
    { x: 30,  y: 350, rotate:  8,  scale: 0.95,opacity: 0.3,  delay: 0.54 },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {envelopes.map((e, i) => (
        <motion.div key={i}
          className="absolute"
          style={{ left: e.x, top: e.y, rotate: e.rotate, scale: e.scale }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: e.opacity, y: 0 }}
          transition={{ delay: e.delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Mail className="h-10 w-10 text-white" strokeWidth={1} />
        </motion.div>
      ))}
      {/* Fade-out at bottom so it feels infinite */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  );
}

// ─── slot-tone — Sparse paragraph lines + blinking cursor ─────────────────
// Screen 7: "How do you write?"
function ToneVisual() {
  // Three short paragraphs separated by gaps — less dense, readable feel
  const paragraphs = [
    [88, 72, 80, 55],
    [92, 68, 76, 60, 82],
    [78, 65, 84, 48],
  ];
  const cursorPara = 1;
  const cursorLine = 2;

  return (
    <div className="flex h-full w-full flex-col justify-center gap-7 py-4">
      {paragraphs.map((lines, pi) => (
        <div key={pi} className="flex flex-col gap-3">
          {lines.map((w, li) => {
            const isCursor = pi === cursorPara && li === cursorLine;
            return (
              <div key={li} className="flex items-center gap-1.5">
                <div
                  className="h-[5px] rounded-full"
                  style={{
                    width: `${isCursor ? 52 : w}%`,
                    backgroundColor: "white",
                    opacity: pi === cursorPara ? 0.28 : 0.14,
                  }}
                />
                {isCursor && (
                  <motion.div
                    className="h-[16px] w-[1.5px] rounded-full bg-white/80 shrink-0"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.85, repeat: Infinity }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── slot-deep — Daily volume bar chart only ──────────────────────────────
// Screen 8: "About your work"
function DeepVisual() {
  const bars = [0.35, 0.55, 0.72, 0.88, 0.60, 0.45, 0.78, 0.92, 0.50, 0.68];

  return (
    <div className="flex h-full w-full flex-col justify-center px-2">
      <div className="flex items-end gap-2.5" style={{ height: "60%" }}>
        {bars.map((val, i) => (
          <motion.div key={i}
            className="flex-1 rounded-t bg-white/25"
            initial={{ height: 0 }}
            animate={{ height: `${val * 100}%` }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <div className="h-px w-full bg-white/15 mt-0" />
    </div>
  );
}

// ─── slot-morning — Roadmap with email card checkpoints ───────────────────
// Screens 10 + 11
function MorningVisual() {
  const checkpoints = [
    { lines: [72, 55], done: true },
    { lines: [80, 62, 44], done: true },
    { lines: [68, 50], done: false },
    { lines: [75, 58, 40], done: false },
  ];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-0 py-4 px-2">
      {checkpoints.map((cp, i) => (
        <motion.div key={i}
          className="flex items-start gap-3"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Timeline spine + node */}
          <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
            {i > 0 && (
              <div className="w-px bg-white/18 flex-none" style={{ height: 12 }} />
            )}
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border",
              cp.done
                ? "border-white/40 bg-white/18"
                : "border-white/16 bg-white/[0.06]",
            )}>
              {cp.done
                ? <Check className="h-3.5 w-3.5 text-white/75" strokeWidth={2.5} />
                : <div className="h-2 w-2 rounded-full bg-white/25" />
              }
            </div>
            {i < checkpoints.length - 1 && (
              <div className="w-px bg-white/18 flex-none" style={{ height: 12 }} />
            )}
          </div>

          {/* Email card skeleton */}
          <div className={cn(
            "flex-1 rounded-lg border p-3 mb-1",
            cp.done
              ? "border-white/18 bg-white/[0.07]"
              : "border-white/8 bg-white/[0.03]",
          )}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="h-2.5 rounded-full bg-white/30" style={{ width: `${cp.lines[0]}%` }} />
              <div className="h-2 w-10 rounded-full bg-white/14 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {cp.lines.slice(1).map((w, j) => (
                <div key={j} className="h-2 rounded-full bg-white/14" style={{ width: `${w}%` }} />
              ))}
            </div>
            {cp.done && (
              <div className="mt-2 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-white/35" />
                <div className="h-1.5 w-16 rounded-full bg-white/20" />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── slot-notify — BellRing + every-day ticked calendar ──────────────────
// Screen 12: "Show up every morning"
function NotifyVisual() {
  const days = ["M", "T", "W", "T", "F"];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10">
      {/* Bell */}
      <div className="relative flex items-center justify-center">
        {[1, 2].map((ring) => (
          <motion.div key={ring}
            className="absolute rounded-full border border-white/12"
            style={{ width: 80 + ring * 36, height: 80 + ring * 36 }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 3, delay: 0.8 + ring * 0.35, repeat: Infinity, repeatDelay: 3 }}
          />
        ))}
        <motion.div
          animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
          transition={{ duration: 2.8, delay: 0.6, repeat: Infinity, repeatDelay: 3.5 }}
        >
          <BellRing className="h-20 w-20 text-white/40" strokeWidth={1} />
        </motion.div>
      </div>

      {/* Calendar — every day ticked */}
      <motion.div
        className="w-full rounded-xl border border-white/14 bg-white/[0.05] overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 bg-white/[0.04]">
          <Calendar className="h-3.5 w-3.5 text-white/45" />
          <span className="text-[10px] font-medium text-white/45 uppercase tracking-wider">Weekdays · 8:00 AM</span>
        </div>
        <div className="flex items-center justify-around px-6 py-4">
          {days.map((d, i) => (
            <motion.div key={i}
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.35 }}
            >
              <span className="text-[10px] text-white/35">{d}</span>
              <div className="h-8 w-8 rounded-full border border-white/35 bg-white/14 flex items-center justify-center">
                <Check className="h-4 w-4 text-white/70" strokeWidth={2.5} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── slot-privacy — 4 large icons only, 2×2 grid ─────────────────────────
// Screen 13: "Your inbox is yours"
function PrivacyVisual() {
  const icons: LucideIcon[] = [Eye, Lock, Shield, KeyRound];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="grid grid-cols-2 gap-6">
        {icons.map((Icon, i) => (
          <motion.div key={i}
            className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/14 bg-white/[0.07]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.13, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Icon className="h-14 w-14 text-white/50" strokeWidth={1} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Slot registry ───────────────────────────────────────────────────────
const SLOT_VISUALS: Record<string, React.FC> = {
  "slot-welcome":  WelcomeVisual,
  "slot-persona":  PersonaVisual,
  "slot-connect":  ConnectVisual,
  "slot-problems": ProblemsVisual,
  "slot-tone":     ToneVisual,
  "slot-deep":     DeepVisual,
  "slot-morning":  MorningVisual,
  "slot-notify":   NotifyVisual,
  "slot-privacy":  PrivacyVisual,
};

export function VisualPlaceholder({
  slot,
  className,
}: {
  slot: string;
  className?: string;
  label?: string;
}) {
  const Visual = SLOT_VISUALS[slot] ?? WelcomeVisual;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl",
        "bg-black/65 backdrop-blur-sm",
        "border border-white/[0.07]",
        "flex items-center justify-center p-5",
        className,
      )}
    >
      <Visual />
    </div>
  );
}
