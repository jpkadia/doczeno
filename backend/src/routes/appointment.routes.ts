import { Router, Request, Response, NextFunction } from "express";
import { Appointment } from "@/models";
import { appointmentCreateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { UserRole } from "@/types";

export const appointmentRouter = Router();

// Public: Patient books an appointment
appointmentRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = appointmentCreateSchema.parse(req.body);
      const appointment = await Appointment.create(validated);
      res.status(201).json({
        success: true,
        message: "Appointment request submitted successfully",
        data: { appointment },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Authenticated: Tenant-scoped appointment list
appointmentRouter.get(
  "/",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filter: Record<string, unknown> = {};

      if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
        filter.organizationId = user.organizationId;
      } else if (
        (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) &&
        user.doctorProfileId
      ) {
        filter.doctorId = user.doctorProfileId;
      } else if (user.role !== UserRole.SUPERADMIN) {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const appointments = await Appointment.find(filter)
        .sort({ appointmentDate: 1, timeSlot: 1 })
        .limit(50);

      res.status(200).json({ success: true, data: { appointments } });
    } catch (error) {
      next(error);
    }
  }
);

// Authenticated: Update appointment status (tenant-scoped)
appointmentRouter.patch(
  "/:id/status",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const user = req.user!;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        res.status(404).json({ success: false, error: "Appointment not found", code: "NOT_FOUND" });
        return;
      }

      // Check tenant ownership
      if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || appointment.organizationId?.toString() !== user.organizationId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden: Not your organization appointment", code: "FORBIDDEN" });
          return;
        }
      } else if (
        user.role === UserRole.HOSPITAL_DOCTOR ||
        user.role === UserRole.INDEPENDENT_DOCTOR
      ) {
        if (!user.doctorProfileId || appointment.doctorId.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden: Not your appointment", code: "FORBIDDEN" });
          return;
        }
      }

      appointment.status = status;
      await appointment.save();

      res.status(200).json({ success: true, message: "Appointment status updated", data: { appointment } });
    } catch (error) {
      next(error);
    }
  }
);
