import { Router, Request, Response, NextFunction } from "express";
import { DoctorService } from "@/services/doctor.service";
import { doctorCreateSchema, doctorUpdateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import {
  requireRole,
  requireDoctorAccess,
  preventHospitalDoctorInheritedFieldMutation,
} from "@/middleware/rbac";
import { UserRole } from "@/types";
import { Organization, Website, Doctor } from "@/models";
import { logAuditEvent } from "@/services/audit.service";

export const doctorRouter = Router();

/**
 * GET /api/v1/doctors/me
 * Authenticated: Resolves the current doctor's full profile and any inherited hospital branding
 */
doctorRouter.get(
  "/me",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (!user.doctorProfileId) {
        res.status(404).json({
          success: false,
          error: "No doctor profile associated with current user",
          code: "DOCTOR_PROFILE_NOT_FOUND",
        });
        return;
      }

      const doctor = await Doctor.findById(user.doctorProfileId);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor profile not found", code: "NOT_FOUND" });
        return;
      }

      // Check if this doctor is affiliated with a parent hospital
      let inheritedHospitalData = null;
      if (doctor.organizationId) {
        const parentOrg = await Organization.findById(doctor.organizationId);
        if (parentOrg) {
          inheritedHospitalData = {
            organizationId: parentOrg._id,
            organizationName: parentOrg.name,
            organizationSlug: parentOrg.slug,
            organizationType: parentOrg.type,
            address: parentOrg.address,
            logo: parentOrg.logo,
            galleryPhotos: parentOrg.galleryPhotos || [],
            selectedTheme: parentOrg.selectedTheme,
            faviconUrl: parentOrg.faviconUrl,
            browserTabTitle: parentOrg.browserTabTitle,
            isLocked: true,
            lockMessage: "Managed by Hospital Admin",
          };
        }
      }

      // Fetch the website record for this doctor
      const website = await Website.findOne({ doctorId: doctor._id });

      res.status(200).json({
        success: true,
        data: {
          doctor,
          inheritedHospitalData,
          website,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Get doctor by slug
 */
doctorRouter.get(
  "/slug/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await DoctorService.getBySlug(req.params.slug as string);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, data: { doctor } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public / Authenticated: List doctors with filters and pagination
 */
doctorRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await DoctorService.listDoctors({
        organizationId: req.query.organizationId as string,
        specialization: req.query.specialization as string,
        status: req.query.status as string,
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
 * Authenticated: Get doctor by ID
 */
doctorRouter.get(
  "/:id",
  requireAuthenticatedUser,
  requireDoctorAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await DoctorService.getById(req.params.id as string);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      // Check for inherited hospital details
      let inheritedHospitalData = null;
      if (doctor.organizationId) {
        const parentOrg = await Organization.findById(doctor.organizationId);
        if (parentOrg) {
          inheritedHospitalData = {
            organizationName: parentOrg.name,
            organizationSlug: parentOrg.slug,
            address: parentOrg.address,
            logo: parentOrg.logo,
            galleryPhotos: parentOrg.galleryPhotos || [],
            selectedTheme: parentOrg.selectedTheme,
            faviconUrl: parentOrg.faviconUrl,
            browserTabTitle: parentOrg.browserTabTitle,
            isLocked: true,
          };
        }
      }

      res.status(200).json({ success: true, data: { doctor, inheritedHospitalData } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Protected: Register doctor under a hospital or independently
 * Guard: SUPERADMIN or HOSPITAL_ADMIN for their organization
 */
doctorRouter.post(
  "/",
  requireAuthenticatedUser,
  requireRole([UserRole.SUPERADMIN, UserRole.HOSPITAL_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = doctorCreateSchema.parse(req.body);

      // Hospital Admin can only create doctors under their own organization
      if (req.user?.role === UserRole.HOSPITAL_ADMIN) {
        if (!req.user.organizationId || validated.organizationId !== req.user.organizationId.toString()) {
          res.status(403).json({
            success: false,
            error: "Forbidden: You can only register doctors under your own hospital organization",
            code: "ORGANIZATION_MISMATCH",
          });
          return;
        }
      }

      const doctor = await DoctorService.createDoctor(validated, req.user);

      // Automatically initialize website record if under hospital
      if (doctor.organizationId) {
        const parentOrg = await Organization.findById(doctor.organizationId);
        if (parentOrg) {
          await Website.create({
            slug: `${parentOrg.slug}-${doctor.slug}`,
            websiteType: "HOSPITAL_DOCTOR",
            doctorId: doctor._id,
            organizationId: parentOrg._id,
            templateId: parentOrg.selectedTheme,
            publishStatus: "PUBLISHED",
          });
        }
      }

      res.status(201).json({ success: true, message: "Doctor registered successfully", data: { doctor } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Protected: Update doctor profile
 * Guard: requireDoctorAccess + preventHospitalDoctorInheritedFieldMutation
 */
doctorRouter.put(
  "/:id",
  requireAuthenticatedUser,
  requireDoctorAccess,
  preventHospitalDoctorInheritedFieldMutation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = doctorUpdateSchema.parse(req.body);
      const doctor = await DoctorService.updateDoctor(
        req.params.id as string,
        validated,
        req.user
      );
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }
      res.status(200).json({ success: true, message: "Doctor profile updated", data: { doctor } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/doctors/:id/status
 * Protected: Activate or Deactivate doctor (Hospital Admin for their doctors or Superadmin)
 */
doctorRouter.patch(
  "/:id/status",
  requireAuthenticatedUser,
  requireDoctorAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
        res.status(400).json({
          success: false,
          error: "Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED",
          code: "INVALID_STATUS",
        });
        return;
      }

      const doctor = await Doctor.findById(req.params.id);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      doctor.status = status;
      await doctor.save();

      // Sync website publish status
      const publishStatus = status === "ACTIVE" ? "PUBLISHED" : "DRAFT";
      await Website.updateMany({ doctorId: doctor._id }, { $set: { publishStatus } });

      await logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: "DOCTOR_STATUS_TOGGLED",
        entityType: "Doctor",
        entityId: doctor._id.toString(),
        organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
        doctorId: doctor._id.toString(),
        details: { newStatus: status, doctorName: doctor.doctorName },
      });

      res.status(200).json({
        success: true,
        message: `Doctor status updated to ${status}`,
        data: { doctor },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/doctors/:id
 * Protected: Safe soft delete / deactivate doctor
 */
doctorRouter.delete(
  "/:id",
  requireAuthenticatedUser,
  requireDoctorAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await Doctor.findById(req.params.id);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      // Safe deactivation
      doctor.status = "INACTIVE";
      await doctor.save();

      // Unpublish website
      await Website.updateMany({ doctorId: doctor._id }, { $set: { publishStatus: "DRAFT" } });

      await logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: "DOCTOR_DEACTIVATED",
        entityType: "Doctor",
        entityId: doctor._id.toString(),
        organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
        doctorId: doctor._id.toString(),
        details: { doctorName: doctor.doctorName },
      });

      res.status(200).json({
        success: true,
        message: "Doctor deactivated and public website unpublished",
        data: { doctorId: doctor._id },
      });
    } catch (error) {
      next(error);
    }
  }
);
