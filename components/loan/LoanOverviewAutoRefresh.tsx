"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LoanOverviewAutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isPending) return;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        startTransition(() => router.refresh());
      }
    };
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, isPending, startTransition]);

  return null;
}
