"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient, clearClientAuthState } from "@/lib/api-client";
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
const LAST_ACTIVITY_KEY = "doczeno_last_activity_at";
const AUTH_TOKEN_KEY = "doczeno_auth_token";
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // Sync active session with server at most every 4m

function readStoredActivity(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function InactivityGuard({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logoutRedirectUrl = "/admin/login",
  onTimeout,
}: InactivityGuardProps) {
  const router = useRouter();
  const initialStored = readStoredActivity();
  const lastActivityRef = React.useRef<number>(initialStored ?? Date.now());
  const lastPersistRef = React.useRef<number>(0);
  const lastHeartbeatSentAtRef = React.useRef<number>(Date.now());
  const hasActivitySinceHeartbeatRef = React.useRef<boolean>(false);
  const isLoggingOutRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const persistActivity = (ts: number, force = false) => {
      if (typeof window === "undefined") return;
      if (!force && ts - lastPersistRef.current < 2000) return;
      lastPersistRef.current = ts;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
      } catch {}
    };

    // Ensure an initial timestamp exists if none was stored yet
    if (readStoredActivity() === null) {
      const now = Date.now();
      lastActivityRef.current = now;
      persistActivity(now, true);
    }

    const triggerLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        // Clear server-side session FIRST (so JWT is still sent and session is marked INACTIVITY)
        await apiClient.post("/auth/logout", { reason: "INACTIVITY" });
      } catch {
        // Ignore network/401 errors during logout
      }

      clearClientAuthState();

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
    };

    const getEffectiveLastActivity = (): number => {
      const stored = readStoredActivity();
      if (stored && stored > lastActivityRef.current) {
        lastActivityRef.current = stored;
      }
      return lastActivityRef.current;
    };

    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      const effectiveLast = getEffectiveLastActivity();
      const idleDuration = now - effectiveLast;

      if (idleDuration >= timeoutMs) {
        triggerLogout();
        return;
      }

      // Keep backend AdminSession.lastActivityAt fresh ONLY if user actually interacted recently
      if (
        hasActivitySinceHeartbeatRef.current &&
        now - lastHeartbeatSentAtRef.current >= HEARTBEAT_INTERVAL_MS
      ) {
        hasActivitySinceHeartbeatRef.current = false;
        lastHeartbeatSentAtRef.current = now;
        apiClient.post("/auth/heartbeat", {}).catch(() => {});
      }
    };

    // Immediate check on mount (catches closed/reopened tabs or slept laptops!)
    checkInactivity();

    const recordActivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      // If timer already elapsed before this interaction (e.g. device woke from sleep), enforce logout first
      if (now - getEffectiveLastActivity() >= timeoutMs) {
        triggerLogout();
        return;
      }
      lastActivityRef.current = now;
      hasActivitySinceHeartbeatRef.current = true;
      persistActivity(now);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY && !e.newValue && !isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
        if (typeof window !== "undefined") {
          window.location.replace(logoutRedirectUrl);
        } else {
          router.replace(logoutRedirectUrl);
        }
      } else if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const parsed = Number(e.newValue);
        if (Number.isFinite(parsed) && parsed > lastActivityRef.current) {
          lastActivityRef.current = parsed;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", checkInactivity);
    window.addEventListener("storage", handleStorageSync);

    const intervalId = window.setInterval(checkInactivity, 10000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", checkInactivity);
      window.removeEventListener("storage", handleStorageSync);
      window.clearInterval(intervalId);
    };
  }, [timeoutMs, logoutRedirectUrl, onTimeout, router]);

  return <>{children}</>;
}
