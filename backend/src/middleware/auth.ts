import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getEnv } from "@/config/env";
import { AuthUserPayload } from "@/types";

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

export function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
    return;
  }
  next();
}
