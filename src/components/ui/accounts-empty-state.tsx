"use client";

import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AccountsEmptyState() {
  function connectGmail() {
    const returnPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/inbox";
    void signIn("google", {
      callbackUrl: `/auth/complete?next=${encodeURIComponent(returnPath)}`,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
        <Mail className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-base font-medium text-foreground">No accounts connected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Gmail to load your inbox. One Google sign-in grants inbox access.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="sm" onClick={connectGmail}>
          Connect Gmail
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
    </div>
  );
}
