import { Router, Request, Response, NextFunction } from "express";
import { WebsiteService } from "@/services/website.service";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireWebsiteAccess, requireRole } from "@/middleware/rbac";
import { UserRole } from "@/types";
import { Website } from "@/models";

export const websiteRouter = Router();

/**
 * Public: Resolves effective website rendering data dynamically at runtime.
 * Implements runtime data inheritance for child hospital doctors without data duplication.
 */
websiteRouter.get(
  "/effective/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await WebsiteService.resolveEffectiveWebsiteData(
        req.params.slug as string
      );
      if (!data) {
        res.status(404).json({
          success: false,
          error: "Website not found or parent entity unavailable",
          code: "NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Resolves effective website rendering data for affiliated hospital doctors
 * Route: /api/v1/websites/effective/:orgSlug/:doctorSlug
 * Enforces internal ID ownership between organization and doctor.
 */
websiteRouter.get(
  "/effective/:orgSlug/:doctorSlug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await WebsiteService.resolveEffectiveHospitalDoctorData(
        req.params.orgSlug as string,
        req.params.doctorSlug as string
      );
      if (!data) {
        res.status(404).json({
          success: false,
          error: "Hospital doctor website not found or affiliated organization unavailable",
          code: "NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Authenticated: Resolves the website belonging to the current authenticated actor
 */
websiteRouter.get(
  "/me",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      let website = null;

      if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
        website = await Website.findOne({ organizationId: user.organizationId, websiteType: "HOSPITAL_CLINIC" });
      } else if (user.doctorProfileId) {
        website = await Website.findOne({ doctorId: user.doctorProfileId });
      }

      if (!website) {
        res.status(404).json({ success: false, error: "Website not found for current actor", code: "NOT_FOUND" });
        return;
      }

      res.status(200).json({ success: true, data: { website } });
    } catch (error) {
      next(error);
    }
  }
);

// Authenticated: Get website by ID
websiteRouter.get(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const website = await WebsiteService.getById(req.params.id as string);
      if (!website) {
        res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, data: { website } });
    } catch (error) {
      next(error);
    }
  }
);

// Protected: Create website
websiteRouter.post(
  "/",
  requireAuthenticatedUser,
  requireRole([UserRole.SUPERADMIN, UserRole.HOSPITAL_ADMIN, UserRole.INDEPENDENT_DOCTOR]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const website = await WebsiteService.createWebsite(req.body, req.user);
      res.status(201).json({ success: true, message: "Website created", data: { website } });
    } catch (error) {
      next(error);
    }
  }
);

// Protected: Update website (guarded by requireWebsiteAccess)
websiteRouter.put(
  "/:id",
  requireAuthenticatedUser,
  requireWebsiteAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const website = await WebsiteService.getById(req.params.id as string);
      if (!website) {
        res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
        return;
      }

      Object.assign(website, req.body);
      await website.save();

      res.status(200).json({ success: true, message: "Website updated", data: { website } });
    } catch (error) {
      next(error);
    }
  }
);
