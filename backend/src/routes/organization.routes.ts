import { Router, Request, Response, NextFunction } from "express";
import { OrganizationService } from "@/services/organization.service";
import { organizationCreateSchema, organizationUpdateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireRole, requireOrganizationAccess } from "@/middleware/rbac";
import { UserRole } from "@/types";

export const organizationRouter = Router();

// Public: Get organization by slug
organizationRouter.get(
  "/slug/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await OrganizationService.getBySlug(req.params.slug as string);
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, data: { organization: org } });
    } catch (error) {
      next(error);
    }
  }
);

// Public or Authenticated: List organizations
organizationRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await OrganizationService.listOrganizations({
        status: req.query.status as string,
        city: req.query.city as string,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        skip: req.query.skip ? Number(req.query.skip) : undefined,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Authenticated: Get organization by ID (with tenant isolation check)
organizationRouter.get(
  "/:id",
  requireAuthenticatedUser,
  requireOrganizationAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await OrganizationService.getById(req.params.id as string);
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, data: { organization: org } });
    } catch (error) {
      next(error);
    }
  }
);

// Protected: Create organization (SUPERADMIN only)
organizationRouter.post(
  "/",
  requireAuthenticatedUser,
  requireRole([UserRole.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = organizationCreateSchema.parse(req.body);
      const org = await OrganizationService.createOrganization(validated, req.user);
      res.status(201).json({ success: true, message: "Organization created", data: { organization: org } });
    } catch (error) {
      next(error);
    }
  }
);

// Protected: Update organization (SUPERADMIN or assigned HOSPITAL_ADMIN)
organizationRouter.put(
  "/:id",
  requireAuthenticatedUser,
  requireOrganizationAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = organizationUpdateSchema.parse(req.body);
      const org = await OrganizationService.updateOrganization(
        req.params.id as string,
        validated,
        req.user
      );
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, message: "Organization updated", data: { organization: org } });
    } catch (error) {
      next(error);
    }
  }
);
