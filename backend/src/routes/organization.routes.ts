import { Router, Request, Response, NextFunction } from "express";
import { OrganizationService } from "@/services/organization.service";
import { aiContentService, resolveOrganizationSpecialties } from "@/services/ai-content.service";
import { organizationCreateSchema, organizationUpdateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireRole, requireOrganizationAccess } from "@/middleware/rbac";
import { UserRole } from "@/types";
import { Organization, Website, Doctor } from "@/models";

export const organizationRouter = Router();

/**
 * GET /api/v1/organizations/me
 * Authenticated: Resolves the current hospital admin's organization and website
 */
organizationRouter.get(
  "/me",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (!user.organizationId) {
        res.status(404).json({
          success: false,
          error: "No organization associated with current user",
          code: "ORGANIZATION_NOT_FOUND",
        });
        return;
      }

      const organization = await Organization.findById(user.organizationId);
      if (!organization) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }

      const website = await Website.findOne({ organizationId: organization._id, websiteType: "HOSPITAL_CLINIC" });
      const doctorCount = await Doctor.countDocuments({ organizationId: organization._id, status: "ACTIVE" });

      res.status(200).json({
        success: true,
        data: {
          organization,
          website,
          stats: {
            activeDoctors: doctorCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/organizations/me
 * Authenticated: Update current hospital admin's organization, theme, and branding
 * Updates propagate to all child websites and connected doctors automatically.
 */
organizationRouter.patch(
  "/me",
  requireAuthenticatedUser,
  requireRole([UserRole.HOSPITAL_ADMIN, UserRole.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (!user.organizationId) {
        res.status(404).json({
          success: false,
          error: "No organization associated with current user",
          code: "ORGANIZATION_NOT_FOUND",
        });
        return;
      }

      const validated = organizationUpdateSchema.parse(req.body);
      const org = await OrganizationService.updateOrganization(
        user.organizationId.toString(),
        validated,
        user
      );
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }

      // If theme was updated, update all website records for this hospital and affiliated doctors
      if (validated.selectedTheme) {
        await Website.updateMany(
          { organizationId: org._id },
          { $set: { templateId: validated.selectedTheme } }
        );
      }

      // Sync SEO tab title and favicon
      if (validated.browserTabTitle || validated.faviconUrl || validated.logo?.url) {
        const seoUpdates: Record<string, unknown> = {};
        if (validated.browserTabTitle) {
          seoUpdates["browserTabTitle"] = validated.browserTabTitle;
          seoUpdates["seoMetadata.title"] = validated.browserTabTitle;
        }
        if (validated.faviconUrl) {
          seoUpdates["faviconUrl"] = validated.faviconUrl;
        }
        if (validated.logo?.url) {
          seoUpdates["seoMetadata.ogImage"] = validated.logo.url;
        }
        await Website.updateMany({ organizationId: org._id, websiteType: "HOSPITAL_CLINIC" }, { $set: seoUpdates });
      }

      res.status(200).json({
        success: true,
        message: "Hospital profile and theme updated successfully",
        data: { organization: org },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Get organization by slug
 */
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

/**
 * Public or Authenticated: List organizations
 */
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

/**
 * Authenticated: Get organization by ID (with tenant isolation check)
 */
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

/**
 * Protected: Create organization (SUPERADMIN only)
 */
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

/**
 * Protected: Update organization (SUPERADMIN or assigned HOSPITAL_ADMIN)
 * Handles updating hospital profile, contact, working hours, theme, branding, favicon, tab title.
 */
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

      // If theme was updated, update the Website record templateId
      if (validated.selectedTheme) {
        await Website.updateMany(
          { organizationId: org._id },
          { $set: { templateId: validated.selectedTheme } }
        );
      }

      res.status(200).json({ success: true, message: "Organization updated successfully", data: { organization: org } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/organizations/:id/departments
 * Protected: Add department to hospital
 */
organizationRouter.post(
  "/:id/departments",
  requireAuthenticatedUser,
  requireOrganizationAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentName } = req.body;
      if (!departmentName || typeof departmentName !== "string" || !departmentName.trim()) {
        res.status(400).json({ success: false, error: "Department name is required", code: "BAD_REQUEST" });
        return;
      }

      const org = await Organization.findById(req.params.id);
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }

      const cleanDept = departmentName.trim();
      const currentSpecs = resolveOrganizationSpecialties(org as any);
      if (!currentSpecs.some((s) => s.toLowerCase() === cleanDept.toLowerCase())) {
        currentSpecs.push(cleanDept);
        org.specialties = currentSpecs;
        (org as any).departments = currentSpecs;
        await org.save();
        await aiContentService.syncHospitalSpecialtiesToContent(org._id, currentSpecs, org.address?.city);
      }

      res.status(200).json({
        success: true,
        message: `Specialty '${cleanDept}' added`,
        data: { departments: org.specialties, specialties: org.specialties },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/organizations/:id/departments/:deptName
 * Protected: Remove department from hospital
 */
organizationRouter.delete(
  "/:id/departments/:deptName",
  requireAuthenticatedUser,
  requireOrganizationAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDept = (req.params.deptName as string) || "";
      const deptName = decodeURIComponent(rawDept);
      const org = await Organization.findById(req.params.id);
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }

      const currentSpecs = resolveOrganizationSpecialties(org as any);
      const nextSpecs = currentSpecs.filter((d: string) => d !== deptName);
      if (nextSpecs.length === 0) {
        res.status(400).json({
          success: false,
          error: "Minimum 1 medical specialty / department is required on your hospital website.",
          code: "MIN_SPECIALTY_REQUIRED",
        });
        return;
      }

      org.specialties = nextSpecs;
      (org as any).departments = nextSpecs;
      await org.save();
      await aiContentService.syncHospitalSpecialtiesToContent(org._id, nextSpecs, org.address?.city);

      res.status(200).json({
        success: true,
        message: `Specialty '${deptName}' removed`,
        data: { departments: org.specialties, specialties: org.specialties },
      });
    } catch (error) {
      next(error);
    }
  }
);
