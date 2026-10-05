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

export const doctorRouter = Router();

// Public: Get doctor by slug
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

// Public / Authenticated: List doctors
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

// Authenticated: Get doctor by ID
doctorRouter.get(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await DoctorService.getById(req.params.id as string);
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

// Protected: Create doctor (SUPERADMIN or HOSPITAL_ADMIN for their organization)
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
      res.status(201).json({ success: true, message: "Doctor registered", data: { doctor } });
    } catch (error) {
      next(error);
    }
  }
);

// Protected: Update doctor profile
// Guarded by requireDoctorAccess and preventHospitalDoctorInheritedFieldMutation
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
