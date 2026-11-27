import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { getEnv } from "@/config/env";
import { authenticate } from "@/middleware/auth";
import { errorHandler } from "@/middleware/error";
import { apiV1Router } from "@/routes";
import { CustomDomainService } from "@/services/custom-domain.service";

export function createApp(): Application {
  const app = express();
  const env = getEnv();

  // Trust reverse proxy (Render, Cloudflare, Vercel)
  app.set("trust proxy", 1);

  // Helmet Security Headers (allow cross-origin embedding for media assets like images/logos)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Parse allowed frontend origins from environment (supports comma-separated list)
  const configuredOrigins = (env.FRONTEND_URL || "")
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([...configuredOrigins, "http://localhost:3000", "http://localhost:3001"])
  );

  // CORS Configuration supporting production cross-domain credentials & dynamic verified custom domains
  app.use(
    cors({
      origin: async (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Render health checks, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/+$/, "");

        // Explicitly allowed origin
        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        // Allow any Vercel deployment (preview or production domains)
        if (/^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(normalizedOrigin)) {
          return callback(null, true);
        }

        // In development, allow localhost on any port
        if (env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin)) {
          return callback(null, true);
        }

        // Dynamically allow registered custom domains (e.g. https://parthkadiya.com)
        try {
          const isCustomDomainAllowed = await CustomDomainService.isAllowedCustomOrigin(normalizedOrigin);
          if (isCustomDomainAllowed) {
            return callback(null, true);
          }
        } catch {
          // Fall through to deny
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "X-Custom-Domain-Host",
      ],
      maxAge: 86400, // 24 hours
    })
  );

  // Ultra-fast root and health check endpoints for Render and frontend warm-up
  app.get(["/", "/health", "/api/health"], (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      name: "Doczeno Medical API",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Body and cookie parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // Request logger (in non-test environments)
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // Session Authentication Middleware
  app.use(authenticate);

  // Mount API v1
  app.use("/api/v1", apiV1Router);

  // 404 Catch-All Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
      code: "ROUTE_NOT_FOUND",
    });
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}
