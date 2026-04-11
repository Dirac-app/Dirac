"use client";

import { cn } from "@/lib/utils";
import { Inbox, Search, CheckCircle2, Mail, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  type: "no-accounts" | "no-threads" | "no-results" | "all-done";
  className?: string;
}

const EMPTY_STATES = {
  "no-accounts": {
    icon: Link2,
    title: "Welcome to Dirac",
    description: "Connect your email accounts to get started",
    action: {
      label: "Connect an account",
      href: "/settings",
    },
  },
  "no-threads": {
    icon: Inbox,
    title: "All caught up",
    description: "No new messages in your inbox",
    action: null,
  },
  "no-results": {
    icon: Search,
    title: "No threads found",
    description: "Try adjusting your search or filters",
    action: {
      label: "Clear filters",
      href: null,
    },
  },
  "all-done": {
    icon: CheckCircle2,
    title: "You've handled everything",
    description: "Great job! Your inbox is clear",
    action: null,
  },
};

export function EmptyState({ type, className }: EmptyStateProps) {
  const state = EMPTY_STATES[type];
  const Icon = state.icon;

  return (
    <div className={cn("flex flex-col items-center justify-center px-8 py-20 text-center gap-4", className)}>
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-base font-medium text-foreground">{state.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
      </div>
      {state.action && (
        <Button size="sm" asChild>
          {state.action.href ? (
            <Link href={state.action.href}>{state.action.label}</Link>
          ) : (
            <button>{state.action.label}</button>
          )}
        </Button>
      )}
    </div>
  );
}

export function AccountsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 text-center gap-4">
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
        <Mail className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-base font-medium text-foreground">No accounts connected</p>
        <p className="mt-1 text-sm text-muted-foreground">Connect Gmail or Outlook in settings</p>
      </div>
      <Button size="sm" asChild>
        <Link href="/settings">Connect an account</Link>
      </Button>
    </div>
  );
}

export function SearchEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
      <Search className="mb-3 h-8 w-8 text-muted-foreground/25" />
      <p className="text-sm text-muted-foreground">No threads match your search</p>
    </div>
  );
}