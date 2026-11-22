"use client";

import * as React from "react";

const PING_INTERVAL_MS = 9 * 60 * 1000; // 9 minutes (keeps free tier awake while active, Render sleeps at 15m)

export function BackendWarmup() {
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const triggerPing = () => {
      try {
        const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
        const rootBase = rawApiUrl.replace(/\/api\/v1\/?$/, "");
        const healthUrl = `${rootBase}/health`;

        // Send non-blocking background keep-alive ping to wake up or keep Render warm
        fetch(healthUrl, {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          keepalive: true,
        }).catch(() => {
          // Silent catch: cold starts or intermittent network blips are ignored
        });
      } catch {
        // Suppress any errors
      }
    };

    if (typeof window !== "undefined") {
      // Trigger ping after main thread is idle so initial page render is never delayed
      if ("requestIdleCallback" in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
          () => triggerPing(),
          { timeout: 2000 }
        );
      } else {
        setTimeout(triggerPing, 1000);
      }

      // Keep backend warm every 9 minutes while the tab is active
      timer = setInterval(triggerPing, PING_INTERVAL_MS);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
