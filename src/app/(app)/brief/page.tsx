"use client";

import { useEffect } from "react";
import { BriefView } from "@/components/morning/brief-view";
import { getMorningStorageKey } from "@/components/morning/morning-briefing";

export default function BriefPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mark today's brief as seen so the nav pulse clears and the auto-redirect
    // on /inbox does not trigger again.
    window.localStorage.setItem(getMorningStorageKey(), "1");
    window.dispatchEvent(new CustomEvent("dirac:brief-seen"));
  }, []);

  return <BriefView />;
}
