import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { getEnv } from "@/config/env";
import { authenticate } from "@/middleware/auth";
import { errorHandler } from "@/middleware/error";
import { apiV1Router } from "@/routes";

export function createApp(): Application {
  const app = express();
  const env = getEnv();

  // Helmet Security Headers (allow cross-origin embedding for media assets like images/logos)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Strict CORS Configuration
  const allowedOrigins = [env.FRONTEND_URL, "http://localhost:3000"];
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked request from origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      maxAge: 86400, // 24 hours
    })
  );

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
