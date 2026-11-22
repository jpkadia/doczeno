"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface InactivityGuardProps {
  children: React.ReactNode;
  /** Timeout in milliseconds. Defaults to 15 minutes (900,000 ms) */
  timeoutMs?: number;
  /** Destination to redirect after session expiration */
  logoutRedirectUrl?: string;
  /** Optional custom callback on timeout */
  onTimeout?: () => void;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (OWASP / HIPAA standard)

export function InactivityGuard({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logoutRedirectUrl = "/admin/login",
  onTimeout,
}: InactivityGuardProps) {
  const router = useRouter();
  const lastActivityRef = React.useRef<number>(Date.now());
  const isLoggingOutRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    // Reset activity timestamp
    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    // Attach passive listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    // Check inactivity periodically every 10 seconds
    const intervalId = window.setInterval(async () => {
      if (isLoggingOutRef.current) return;

      const idleDuration = Date.now() - lastActivityRef.current;
      if (idleDuration >= timeoutMs) {
        isLoggingOutRef.current = true;

        try {
          // Clear server-side session cookie
          await apiClient.post("/auth/logout");
        } catch {
          // Ignore network errors during logout
        }

        toast.warning("Session expired due to inactivity. Please log in again.", {
          duration: 6000,
        });

        if (onTimeout) {
          onTimeout();
        } else {
          const redirectTarget = logoutRedirectUrl.includes("?")
            ? `${logoutRedirectUrl}&reason=inactivity`
            : `${logoutRedirectUrl}?reason=inactivity`;
          if (typeof window !== "undefined") {
            window.location.replace(redirectTarget);
          } else {
            router.replace(redirectTarget);
          }
        }
      }
    }, 10000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, recordActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [timeoutMs, logoutRedirectUrl, onTimeout, router]);

  return <>{children}</>;
}
