"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/Toast";

/**
 * Reads ?welcome=true from the URL after sign-in redirect, shows a success
 * toast, and removes the query param so it only fires once per visit.
 */
export default function WelcomeToast() {
  const params = useSearchParams();

  useEffect(() => {
    if (!params.get("welcome")) return;
    // Remove the query param so the toast doesn't re-trigger on navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState({}, "", url.toString());
    toast.success("Signed in successfully!", { duration: 4000 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
