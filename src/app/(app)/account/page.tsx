"use client";

import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  Loader2,
  CreditCard,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Outlook icon ──────────────────────────────────────

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

// ─── Gmail scopes for reconnect ────────────────────────

const GMAIL_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

// ─── Billing info types ────────────────────────────────

interface BillingInfo {
  subscription_status: "trialing" | "active" | "expired";
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_days_remaining: number | null;
  member_since: string;
  emails_processed_count: number;
  ai_drafts_count: number;
  stripe_status: string | null;
  plan_interval: "monthly" | "annual" | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_stripe_customer: boolean;
  price_amount: number | null;
  price_currency: string | null;
  subscription_created: string | null;
  invoice_url: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtPrice(cents: number | null, currency: string | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function PlanDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  );
}

// ─── Offboarding modal ─────────────────────────────────

const CANCEL_REASONS = [
  "Found a better alternative",
  "Not enough time to use it",
  "Missing features I need",
  "Too expensive",
  "Had technical issues",
  "Just trying it out — never planned to pay",
  "Other",
];

interface OffboardingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (answers: { reason: string; improvement: string; comeback: string }) => Promise<void>;
  loading: boolean;
  result: { cancelAt: string | null; wasTrialing: boolean } | null;
}

function OffboardingModal({ open, onClose, onConfirm, loading, result }: OffboardingModalProps) {
  const [reason, setReason] = useState("");
  const [improvement, setImprovement] = useState("");
  const [comeback, setComeback] = useState("");

  function handleClose() {
    setReason("");
    setImprovement("");
    setComeback("");
    onClose();
  }

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Done
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.wasTrialing
              ? "Your trial has been cancelled. No charge was made."
              : result.cancelAt
              ? `Your plan will stay active until ${result.cancelAt}, then access ends. No further charges.`
              : "Your subscription has been cancelled."}
          </p>
          <p className="text-sm text-muted-foreground">
            If you change your mind, email{" "}
            <a href="mailto:peter@dirac.app" className="text-primary underline underline-offset-2">
              peter@dirac.app
            </a>{" "}
            and we'll sort it out.
          </p>
          <Button variant="outline" className="w-full" onClick={handleClose}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sorry to see you go</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Before you go — two quick questions. Helps me make Dirac better for everyone.
        </p>

        {/* Q1: Why */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Why are you cancelling?</p>
          <div className="space-y-1.5">
            {CANCEL_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
                  reason === r
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground/40",
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-primary"
                />
                {r}
              </label>
            ))}
          </div>
        </div>

        {/* Q2: Improvement */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            What&apos;s the #1 thing Dirac could have done better?{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </p>
          <textarea
            value={improvement}
            onChange={(e) => setImprovement(e.target.value)}
            rows={2}
            placeholder="Be blunt — I read every response"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Q3: Comeback */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            What would bring you back?{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </p>
          <textarea
            value={comeback}
            onChange={(e) => setComeback(e.target.value)}
            rows={2}
            placeholder="A feature, a price, something else?"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
            Keep my plan
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!reason || loading}
            onClick={() => void onConfirm({ reason, improvement, comeback })}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel my plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main account page ─────────────────────────────────

function AccountPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const gmailConnected = session?.gmailConnected ?? false;

  const [outlookStatus, setOutlookStatus] = useState<{ connected: boolean; email?: string }>({ connected: false });
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ cancelAt: string | null; wasTrialing: boolean } | null>(null);

  // ── Fetch Outlook status ─────────────────────────────

  const fetchOutlookStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/outlook/status");
      if (res.ok) {
        const data = await res.json() as { connected: boolean; email?: string };
        setOutlookStatus(data);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Fetch billing info ───────────────────────────────

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/user/billing");
      if (res.ok) {
        const data = await res.json() as BillingInfo;
        setBilling(data);
      }
    } catch { /* ignore */ }
    finally { setBillingLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchOutlookStatus();
      void fetchBilling();
    }
  }, [status, fetchOutlookStatus, fetchBilling]);

  // Outlook OAuth callback
  useEffect(() => {
    if (searchParams.get("outlook") === "connected") {
      void fetchOutlookStatus();
    }
  }, [searchParams, fetchOutlookStatus]);

  // ── Handlers ─────────────────────────────────────────

  const handleGmailConnect = () => {
    setGmailLoading(true);
    void signIn("google", { callbackUrl: "/account" }, { scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent" });
  };

  const handleGmailDisconnect = () => {
    setGmailLoading(true);
    void signOut({ callbackUrl: "/account" });
  };

  const handleOutlookConnect = () => {
    window.location.href = "/api/oauth/outlook";
  };

  const handleOutlookDisconnect = async () => {
    setOutlookLoading(true);
    try {
      await fetch("/api/outlook/status", { method: "DELETE" });
      setOutlookStatus({ connected: false });
    } catch { /* ignore */ }
    finally { setOutlookLoading(false); }
  };

  const handleCancelConfirm = async (answers: { reason: string; improvement: string; comeback: string }) => {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json() as { ok: boolean; cancelAt: string | null; wasTrialing: boolean };
      if (data.ok) {
        setCancelResult({ cancelAt: data.cancelAt, wasTrialing: data.wasTrialing });
        void fetchBilling();
      }
    } catch { /* ignore */ }
    finally { setCancelLoading(false); }
  };

  // ── Derived display values ────────────────────────────

  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? session?.user?.email?.split("@")[0] ?? "there";
  const initials = session?.user?.name
    ? session.user.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : (session?.user?.email?.[0] ?? "?").toUpperCase();

  function getPlanName() {
    if (!billing) return "Dirac";
    if (billing.stripe_status === "trialing") {
      if (billing.plan_interval === "annual") return "Dirac Annual (trial)";
      if (billing.plan_interval === "monthly") return "Dirac Monthly (trial)";
      return "Dirac Trial";
    }
    if (billing.plan_interval === "annual") return "Dirac Annual";
    if (billing.plan_interval === "monthly") return "Dirac Monthly";
    return "Dirac";
  }

  function getStatusBadge() {
    if (!billing) return null;
    if (billing.cancel_at_period_end) {
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] text-amber-600">
          <AlertTriangle className="h-2.5 w-2.5" />
          Cancelling
        </Badge>
      );
    }
    if (billing.stripe_status === "trialing") {
      return (
        <Badge variant="secondary" className="text-[10px]">
          Trial{billing.trial_days_remaining != null ? ` · ${billing.trial_days_remaining}d left` : ""}
        </Badge>
      );
    }
    if (billing.stripe_status === "active") {
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] text-green-600">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Active
        </Badge>
      );
    }
    if (billing.subscription_status === "expired") {
      return (
        <Badge variant="secondary" className="text-[10px] text-muted-foreground">
          Expired
        </Badge>
      );
    }
    return null;
  }

  function getPriceLabel() {
    if (!billing) return null;
    const formatted = fmtPrice(
      billing.price_amount,
      billing.price_currency,
    );
    if (formatted && billing.plan_interval === "annual") return `${formatted}/year`;
    if (formatted && billing.plan_interval === "monthly") return `${formatted}/month`;
    if (billing.plan_interval === "annual") return "$200/year";
    if (billing.plan_interval === "monthly") return "$20/month";
    return null;
  }

  const canCancel =
    billing?.stripe_status === "trialing" ||
    (billing?.stripe_status === "active" && !billing.cancel_at_period_end);

  const hasActivePlan =
    billing?.has_stripe_customer &&
    billing.subscription_status !== "expired" &&
    (billing.stripe_status === "trialing" || billing.stripe_status === "active");

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-foreground">Account</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-6 py-6 space-y-8">

          {/* ── Header: avatar + name ── */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {session?.user?.name ?? firstName}
              </p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
          </div>

          <Separator />

          {/* ── Profile ── */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile</h2>
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
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Connected accounts ── */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Connected accounts</h2>
            <div className="space-y-3">
              {/* Gmail */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Gmail</span>
                      {gmailConnected && (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal text-green-600">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {gmailConnected ? (session?.user?.email ?? "Google email") : "Google email — read, reply, and send"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={gmailConnected ? "outline" : "default"}
                  size="sm"
                  className="text-xs"
                  onClick={gmailConnected ? handleGmailDisconnect : handleGmailConnect}
                  disabled={gmailLoading}
                >
                  {gmailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : gmailConnected ? "Disconnect" : "Connect"}
                </Button>
              </div>

              {/* Outlook */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <OutlookIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Outlook</span>
                      {outlookStatus.connected && (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal text-green-600">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {outlookStatus.connected ? (outlookStatus.email ?? "Microsoft 365") : "Microsoft 365, Outlook.com, Hotmail"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={outlookStatus.connected ? "outline" : "default"}
                  size="sm"
                  className="text-xs"
                  onClick={outlookStatus.connected ? handleOutlookDisconnect : handleOutlookConnect}
                  disabled={outlookLoading}
                >
                  {outlookLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : outlookStatus.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Billing / Plan ── */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plan</h2>

            {billingLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : !hasActivePlan ? (
              <div className="rounded-lg border border-border px-4 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">No active plan</span>
                  {billing?.subscription_status === "expired" && getStatusBadge()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billing?.subscription_status === "expired"
                    ? "Your subscription has ended. Resubscribe to keep using Dirac."
                    : "Start a free trial to unlock the full inbox."}
                </p>
                {billing && (
                  <div className="border-t border-border pt-2 divide-y divide-border">
                    <PlanDetailRow label="Member since" value={fmtDate(billing.member_since) ?? "—"} />
                    {billing.emails_processed_count > 0 && (
                      <PlanDetailRow label="Emails processed" value={billing.emails_processed_count.toLocaleString()} />
                    )}
                  </div>
                )}
                <a href="/upgrade" className="inline-block pt-1 text-xs text-primary underline underline-offset-2">
                  View plans →
                </a>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-4 py-4 border-b border-border">
                  <div className="flex items-start gap-3 min-w-0">
                    <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{getPlanName()}</span>
                        {getStatusBadge()}
                      </div>
                      {getPriceLabel() && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {billing.stripe_status === "trialing"
                            ? `Then ${getPriceLabel()}`
                            : getPriceLabel()}
                        </p>
                      )}
                    </div>
                  </div>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setCancelOpen(true)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>

                {/* Details grid */}
                <div className="px-4 py-1 divide-y divide-border">
                  <PlanDetailRow label="Status" value={
                    billing.cancel_at_period_end
                      ? "Cancelling at period end"
                      : billing.stripe_status === "trialing"
                      ? "Free trial"
                      : "Paid · active"
                  } />
                  {billing.stripe_status === "trialing" && billing.trial_start_date && (
                    <PlanDetailRow label="Trial started" value={fmtDate(billing.trial_start_date)} />
                  )}
                  {billing.stripe_status === "trialing" && billing.trial_end_date && (
                    <PlanDetailRow
                      label="Trial ends"
                      value={
                        <>
                          {fmtDate(billing.trial_end_date)}
                          {billing.trial_days_remaining != null && billing.trial_days_remaining > 0 && (
                            <span className="text-muted-foreground"> · {billing.trial_days_remaining} day{billing.trial_days_remaining === 1 ? "" : "s"} left</span>
                          )}
                        </>
                      }
                    />
                  )}
                  {billing.stripe_status === "trialing" && billing.trial_end_date && (
                    <PlanDetailRow label="First charge" value={fmtDate(billing.trial_end_date)} />
                  )}
                  {billing.stripe_status === "active" && billing.subscription_created && (
                    <PlanDetailRow label="Subscribed since" value={billing.subscription_created} />
                  )}
                  {billing.stripe_status === "active" && !billing.cancel_at_period_end && billing.current_period_end && (
                    <PlanDetailRow label="Next renewal" value={billing.current_period_end} />
                  )}
                  {billing.cancel_at_period_end && billing.current_period_end && (
                    <PlanDetailRow label="Access until" value={billing.current_period_end} />
                  )}
                  <PlanDetailRow label="Member since" value={fmtDate(billing.member_since) ?? "—"} />
                  {(billing.emails_processed_count > 0 || billing.ai_drafts_count > 0) && (
                    <PlanDetailRow
                      label="Usage"
                      value={
                        [
                          billing.emails_processed_count > 0
                            ? `${billing.emails_processed_count.toLocaleString()} emails`
                            : null,
                          billing.ai_drafts_count > 0
                            ? `${billing.ai_drafts_count.toLocaleString()} AI drafts`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      }
                    />
                  )}
                </div>

                {/* Footer actions */}
                <div className="px-4 py-3 border-t border-border flex flex-wrap items-center gap-3">
                  {billing.invoice_url && (
                    <a
                      href={billing.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      View latest receipt
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {billing.cancel_at_period_end && (
                    <p className="text-xs text-muted-foreground">
                      Want to stay? Email{" "}
                      <a href="mailto:peter@dirac.app" className="text-primary underline underline-offset-2">
                        peter@dirac.app
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      <OffboardingModal
        open={cancelOpen}
        onClose={() => { setCancelOpen(false); setCancelResult(null); }}
        onConfirm={handleCancelConfirm}
        loading={cancelLoading}
        result={cancelResult}
      />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageInner />
    </Suspense>
  );
}
