import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getEnv } from "@/config/env";
import { AuthUserPayload } from "@/types";
import { AdminSession } from "@/models";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function extractAuthToken(req: Request): string | null {
  // Check signed / HTTP-only cookie first
  if (req.cookies && req.cookies["doczeno_session"]) {
    return req.cookies["doczeno_session"];
  }

  // Check Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractAuthToken(req);
  if (!token) {
    return next();
  }

  try {
    const { AUTH_SECRET } = getEnv();
    const decoded = jwt.verify(token, AUTH_SECRET) as AuthUserPayload;
    req.user = decoded;
  } catch {
    // Invalid or expired token, clear user
    req.user = undefined;
  }

  next();
}

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes strict server-side idle timeout

function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("doczeno_session", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
}

export async function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
    return;
  }

  // Enforce server-side session validity & 15-minute inactivity timeout across all admin portals
  if (req.user.sessionId) {
    try {
      const session = await AdminSession.findOne({ sessionId: req.user.sessionId })
        .select("status expiresAt lastActivityAt")
        .lean();

      if (!session) {
        clearSessionCookie(res);
        res.status(401).json({
          success: false,
          error: "Session not found or terminated. Please log in again.",
          code: "SESSION_TERMINATED",
        });
        return;
      }

      const now = new Date();
      if (session.status !== "ACTIVE" || new Date(session.expiresAt) <= now) {
        if (session.status === "ACTIVE" && new Date(session.expiresAt) <= now) {
          await AdminSession.updateOne(
            { sessionId: req.user.sessionId, status: "ACTIVE" },
            { $set: { status: "EXPIRED", logoutAt: now, logoutReason: "SESSION_EXPIRED" } }
          ).catch(() => {});
        }
        clearSessionCookie(res);
        res.status(401).json({
          success: false,
          error: "Session has ended or expired. Please log in again.",
          code: "SESSION_TERMINATED",
        });
        return;
      }

      const idleMs = now.getTime() - new Date(session.lastActivityAt).getTime();
      if (idleMs >= INACTIVITY_TIMEOUT_MS) {
        await AdminSession.updateOne(
          { sessionId: req.user.sessionId, status: "ACTIVE" },
          { $set: { status: "EXPIRED", logoutAt: now, logoutReason: "INACTIVITY" } }
        ).catch(() => {});
        clearSessionCookie(res);
        res.status(401).json({
          success: false,
          error: "Session expired due to 15 minutes of inactivity. Please log in again.",
          code: "SESSION_INACTIVITY_EXPIRED",
        });
        return;
      }

      // Throttled heartbeat update (max once per 60 seconds, or forced by /auth/heartbeat)
      if (idleMs > 60000) {
        AdminSession.updateOne(
          { sessionId: req.user.sessionId, status: "ACTIVE" },
          { $set: { lastActivityAt: now } }
        ).catch(() => {});
      }
    } catch {
      // Do not break auth on transient DB lookup issues
    }
  } else {
    // Legacy token without sessionId: enforce issued-at age <= 15m so idle tokens cannot bypass timeout
    const iatSec = (req.user as unknown as { iat?: number }).iat;
    if (!iatSec || Date.now() - iatSec * 1000 >= INACTIVITY_TIMEOUT_MS) {
      clearSessionCookie(res);
      res.status(401).json({
        success: false,
        error: "Session expired due to inactivity. Please log in again.",
        code: "SESSION_INACTIVITY_EXPIRED",
      });
      return;
    }
  }

  next();
}
