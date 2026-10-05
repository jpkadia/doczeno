import { Router, Request, Response } from "express";
import { checkDatabaseHealth } from "@/db/connection";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbConnected = await checkDatabaseHealth();

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? "connected" : "disconnected",
    },
  });
});
