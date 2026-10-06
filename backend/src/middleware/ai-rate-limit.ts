import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

const windowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 10;
const debounceMs = 2000; // 2 seconds between duplicate triggers

const clientRequests = new Map<string, RateLimitEntry>();
const targetDebounceLocks = new Map<string, number>();

/**
 * Resets the in-memory rate limiting and debounce state (primarily for automated testing)
 */
export function clearAiRateLimitState(): void {
  clientRequests.clear();
  targetDebounceLocks.clear();
}

/**
 * Sliding-window rate limiter & button-spam debounce middleware for AI endpoints
 */
export function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();

  // 1. Determine client identifier (user ID or IP)
  const clientKey = req.user?.userId || req.ip || "unknown-client";

  // Check sliding window
  let entry = clientRequests.get(clientKey);
  if (!entry) {
    entry = { timestamps: [] };
    clientRequests.set(clientKey, entry);
  }

  // Purge old timestamps outside window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequestsPerWindow) {
    res.status(429).json({
      success: false,
      error: "AI generation rate limit exceeded. Please wait a minute before requesting again.",
      code: "AI_RATE_LIMIT_EXCEEDED",
    });
    return;
  }

  // 2. Debounce check for targetId (button spam / double-click prevention)
  const targetId = req.body?.targetId || req.params?.targetId;
  const targetType = req.body?.targetType || req.params?.targetType;

  if (targetId && targetType) {
    const lockKey = `${targetType}:${targetId}`;
    const lastRequest = targetDebounceLocks.get(lockKey);

    if (lastRequest && now - lastRequest < debounceMs) {
      res.status(429).json({
        success: false,
        error: "An AI generation request for this entity is already processing or was just triggered. Please wait.",
        code: "AI_DEBOUNCE_ACTIVE",
      });
      return;
    }

    targetDebounceLocks.set(lockKey, now);
  }

  entry.timestamps.push(now);
  next();
}
