import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

const publicWindowMs = 60 * 1000; // 1 minute
const maxPublicRequestsPerWindow = 15;
const publicDebounceMs = 1500; // 1.5s between rapid duplicate turns

const adminWindowMs = 60 * 1000;
const maxAdminRequestsPerWindow = 30;

const publicClientRequests = new Map<string, RateLimitEntry>();
const publicSessionDebounceLocks = new Map<string, number>();

const adminClientRequests = new Map<string, RateLimitEntry>();

export function clearChatbotRateLimitState(): void {
  publicClientRequests.clear();
  publicSessionDebounceLocks.clear();
  adminClientRequests.clear();
}

/**
 * Aggressive rate limiting and abuse defense for public chatbot endpoints
 */
export function publicChatbotRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const sessionId = req.body?.sessionId || req.params?.sessionId || req.query?.sessionId;
  const clientKey = String(sessionId || req.ip || "public-client");

  // 1. Sliding window rate limit
  let entry = publicClientRequests.get(clientKey);
  if (!entry) {
    entry = { timestamps: [] };
    publicClientRequests.set(clientKey, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < publicWindowMs);

  if (entry.timestamps.length >= maxPublicRequestsPerWindow) {
    res.status(429).json({
      success: false,
      message: "Too many messages sent. Please wait a moment before sending another query.",
      error: "Too many messages sent. Please wait a moment before sending another query.",
      code: "CHATBOT_RATE_LIMIT_EXCEEDED",
    });
    return;
  }

  // 2. Debounce lock per session
  if (sessionId) {
    const sessionKey = String(sessionId);
    const lastRequest = publicSessionDebounceLocks.get(sessionKey);

    if (lastRequest && now - lastRequest < publicDebounceMs) {
      res.status(429).json({
        success: false,
        message: "Please wait a moment before sending your next message.",
        error: "Please wait a moment before sending your next message.",
        code: "CHATBOT_DEBOUNCE_ACTIVE",
      });
      return;
    }

    publicSessionDebounceLocks.set(sessionKey, now);
  }

  // 3. Message length check
  const message = req.body?.message;
  if (typeof message === "string" && message.length > 500) {
    res.status(400).json({
      success: false,
      error: "Message exceeds maximum permitted length of 500 characters",
      code: "MESSAGE_TOO_LONG",
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}

/**
 * Rate limiter for authenticated Admin AI Assistant
 */
export function adminAssistantRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const userKey = req.user?.userId || req.ip || "admin-user";

  let entry = adminClientRequests.get(userKey);
  if (!entry) {
    entry = { timestamps: [] };
    adminClientRequests.set(userKey, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < adminWindowMs);

  if (entry.timestamps.length >= maxAdminRequestsPerWindow) {
    res.status(429).json({
      success: false,
      error: "Admin assistant request limit reached. Please wait a minute.",
      code: "ADMIN_RATE_LIMIT_EXCEEDED",
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}
