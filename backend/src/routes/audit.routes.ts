import { Router, Request, Response, NextFunction } from "express";
import { AuditLog } from "@/models";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { UserRole } from "@/types";

export const auditRouter = Router();

// Superadmin only: view audit logs
auditRouter.get(
  "/",
  requireAuthenticatedUser,
  requireRole([UserRole.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const skip = req.query.skip ? Number(req.query.skip) : 0;

      const [logs, total] = await Promise.all([
        AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
        AuditLog.countDocuments(),
      ]);

      res.status(200).json({ success: true, data: { logs, total } });
    } catch (error) {
      next(error);
    }
  }
);
