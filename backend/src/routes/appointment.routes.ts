import { Router, Request, Response, NextFunction } from "express";
import { Appointment } from "@/models";
import { appointmentCreateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { UserRole } from "@/types";
import { logAuditEvent } from "@/services/audit.service";

export const appointmentRouter = Router();

/**
 * POST /api/v1/appointments
 * Public: Patients request an appointment via the website CTA
 */
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

/**
 * GET /api/v1/appointments
 * Authenticated: Strict role-based and tenant-scoped appointment queries
 */
appointmentRouter.get(
  "/",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filter: Record<string, unknown> = {};
      const { status, doctorId, search, page = "1", limit = "20" } = req.query;

      // 1. Role-based scoping authority:
      if (user.role === UserRole.SUPERADMIN) {
        // Platform wide, optional filter
        if (req.query.organizationId) filter.organizationId = req.query.organizationId;
        if (doctorId) filter.doctorId = doctorId;
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId) {
          res.status(403).json({ success: false, error: "Hospital admin missing organization assignment", code: "FORBIDDEN" });
          return;
        }
        filter.organizationId = user.organizationId;
        // Optionally filter by a doctor belonging to this hospital
        if (doctorId) filter.doctorId = doctorId;
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(403).json({ success: false, error: "Doctor user missing profile link", code: "FORBIDDEN" });
          return;
        }
        // Strict boundary: Doctor sees ONLY their own appointments
        filter.doctorId = user.doctorProfileId;
      } else {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      // 2. Query filters
      if (status && status !== "ALL") {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { patientName: { $regex: search, $options: "i" } },
          { patientPhone: { $regex: search, $options: "i" } },
        ];
      }

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [appointments, total] = await Promise.all([
        Appointment.find(filter)
          .populate("doctorId", "doctorName specialization slug")
          .populate("organizationId", "name slug")
          .sort({ appointmentDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Appointment.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: {
          appointments,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/appointments/:id/status
 * Authenticated: Update appointment status with strict tenant ownership validation
 */
appointmentRouter.patch(
  "/:id/status",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of [${validStatuses.join(", ")}]`,
          code: "INVALID_STATUS",
        });
        return;
      }

      const user = req.user!;
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        res.status(404).json({ success: false, error: "Appointment not found", code: "NOT_FOUND" });
        return;
      }

      // Check tenant ownership boundary:
      if (user.role === UserRole.SUPERADMIN) {
        // Allowed
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || appointment.organizationId?.toString() !== user.organizationId.toString()) {
          res.status(403).json({
            success: false,
            error: "Forbidden: Not an appointment for your hospital organization",
            code: "FORBIDDEN",
          });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) {
        if (!user.doctorProfileId || appointment.doctorId.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({
            success: false,
            error: "Forbidden: You can only manage your own patient appointments",
            code: "FORBIDDEN",
          });
          return;
        }
      } else {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const previousStatus = appointment.status;
      appointment.status = status;
      await appointment.save();

      await logAuditEvent({
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        action: "APPOINTMENT_STATUS_UPDATED",
        entityType: "Appointment",
        entityId: appointment._id.toString(),
        organizationId: appointment.organizationId ? appointment.organizationId.toString() : null,
        doctorId: appointment.doctorId.toString(),
        details: { previousStatus, newStatus: status, patientName: appointment.patientName },
      });

      res.status(200).json({
        success: true,
        message: "Appointment status updated",
        data: { appointment },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/appointments/:id
 * Authenticated: Cancel / soft delete appointment
 */
appointmentRouter.delete(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        res.status(404).json({ success: false, error: "Appointment not found", code: "NOT_FOUND" });
        return;
      }

      // Check tenant authorization
      if (user.role === UserRole.SUPERADMIN) {
        // Allowed
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || appointment.organizationId?.toString() !== user.organizationId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden", code: "FORBIDDEN" });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) {
        if (!user.doctorProfileId || appointment.doctorId.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden", code: "FORBIDDEN" });
          return;
        }
      }

      appointment.status = "CANCELLED";
      await appointment.save();

      res.status(200).json({
        success: true,
        message: "Appointment marked as cancelled",
        data: { appointmentId: appointment._id },
      });
    } catch (error) {
      next(error);
    }
  }
);
