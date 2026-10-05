import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass rate limiter
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "anonymous";
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    const record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
      memoryStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return next();
    }

    record.count++;

    if (record.count > options.maxRequests) {
      res.status(429).json({
        success: false,
        error: options.message || "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      });
      return;
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // 20 attempts
  message: "Too many authentication attempts. Please wait 15 minutes.",
});
