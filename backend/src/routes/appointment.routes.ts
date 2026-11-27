import { Router, Request, Response, NextFunction } from "express";
import { Appointment, Website, Organization, Doctor, SlotCounter } from "@/models";
import { appointmentCreateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { UserRole, WebsiteType } from "@/types";
import { logAuditEvent } from "@/services/audit.service";
import { getBookingWindowDays } from "@/services/appointment-schedule.service";
import {
  AppointmentBookingService,
  inferSlotKeyFromLabel,
  normalizeDateKey,
} from "@/services/appointment-booking.service";

export const appointmentRouter = Router();

/**
 * GET /api/v1/appointments/available-days
 * Public: Returns the 4-day booking window (Day 0 to Day 3) with open/closed status for a doctor/org
 */
appointmentRouter.get(
  "/available-days",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { doctorId, organizationId } = req.query;

      let scheduleRaw: string | undefined;
      let weeklyOffRaw: string | undefined;
      let entityName = "Doctor/Clinic";

      if (doctorId && typeof doctorId === "string") {
        const doc = await Doctor.findById(doctorId).select("doctorName consultationHours weeklyOff").lean();
        if (doc) {
          scheduleRaw = doc.consultationHours;
          weeklyOffRaw = doc.weeklyOff;
          entityName = `Dr. ${doc.doctorName}`;
        }
      }

      if (!scheduleRaw && organizationId && typeof organizationId === "string") {
        const org = await Organization.findById(organizationId).select("name workingHours weeklyOff").lean();
        if (org) {
          scheduleRaw = org.workingHours;
          if (!weeklyOffRaw) weeklyOffRaw = org.weeklyOff;
          if (entityName === "Doctor/Clinic") entityName = org.name;
        }
      }

      const days = getBookingWindowDays(scheduleRaw, weeklyOffRaw);
      res.json({
        success: true,
        data: {
          entityName,
          days,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/appointments/slots
 * Public: Returns configured consultation slots & real-time remaining capacity for a doctor + date
 */
appointmentRouter.get(
  "/slots",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { doctorId, organizationId, slug, doctorSlug, date } = req.query;

      let doctor: any = null;
      let org: any = null;

      if (doctorId && typeof doctorId === "string") {
        doctor = await Doctor.findById(doctorId).lean();
      } else if (slug && typeof slug === "string") {
        const cleanSlug = slug.trim().toLowerCase();
        if (doctorSlug && typeof doctorSlug === "string") {
          org = await Organization.findOne({ slug: cleanSlug }).lean();
          if (org) {
            doctor = await Doctor.findOne({
              organizationId: org._id,
              slug: doctorSlug.trim().toLowerCase(),
            }).lean();
          }
        } else {
          const site = await Website.findOne({ slug: cleanSlug }).lean();
          if (site?.doctorId) {
            doctor = await Doctor.findById(site.doctorId).lean();
          } else if (site?.organizationId) {
            org = await Organization.findById(site.organizationId).lean();
          }
        }
      }

      if (!org && organizationId && typeof organizationId === "string") {
        org = await Organization.findById(organizationId).lean();
      }
      if (!doctor && org) {
        doctor = await Doctor.findOne({
          organizationId: org._id,
          status: "ACTIVE",
          approvalStatus: { $nin: ["PENDING", "REJECTED"] },
        }).lean();
      }
      if (doctor && !org && doctor.organizationId) {
        org = await Organization.findById(doctor.organizationId).lean();
      }

      if (!doctor) {
        res.status(404).json({
          success: false,
          error: "Doctor profile not found",
          code: "DOCTOR_NOT_FOUND",
        });
        return;
      }

      const dateInput = typeof date === "string" && date.trim() ? date.trim() : new Date();
      const result = await AppointmentBookingService.resolveDoctorSlotsForDate({
        doctor,
        org,
        dateInput,
      });

      res.json({
        success: true,
        data: {
          doctorId: doctor._id.toString(),
          doctorName: doctor.doctorName,
          ...result,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/appointments/public-live-queue
 * Public (privacy-safe): Live currently serving token badge for Doctor website
 */
appointmentRouter.get(
  "/public-live-queue",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug, doctorSlug, doctorId } = req.query;
      let doctor: any = null;

      if (doctorId && typeof doctorId === "string") {
        doctor = await Doctor.findById(doctorId).lean();
      } else if (slug && typeof slug === "string") {
        const cleanSlug = slug.trim().toLowerCase();
        if (doctorSlug && typeof doctorSlug === "string") {
          const org = await Organization.findOne({ slug: cleanSlug }).select("_id").lean();
          if (org) {
            doctor = await Doctor.findOne({
              organizationId: org._id,
              slug: doctorSlug.trim().toLowerCase(),
            }).lean();
          }
        } else {
          const site = await Website.findOne({ slug: cleanSlug }).lean();
          if (site?.doctorId) {
            doctor = await Doctor.findById(site.doctorId).lean();
          } else {
            doctor = await Doctor.findOne({ slug: cleanSlug, organizationId: null }).lean();
          }
        }
      }

      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      const summary = await AppointmentBookingService.getLiveQueueSummary({
        doctorId: doctor._id.toString(),
      });

      res.json({
        success: true,
        data: {
          doctorName: summary.doctorName,
          dateKey: summary.dateKey,
          currentServingToken: summary.currentServingToken,
          nextTokenNumber: summary.nextTokenNumber,
          waitingCount: summary.waitingCount,
          slots: summary.slots.map((s) => ({
            slotKey: s.slotKey,
            displayLabel: s.displayLabel,
            currentServingToken: s.currentServingToken,
            maxPatients: s.maxPatients,
            bookedCount: s.bookedCount,
            remainingSeats: s.remainingSeats,
            isFull: s.isFull,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/appointments
 * Public & Admin: Atomic slot-locked booking endpoint
 */
appointmentRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = appointmentCreateSchema.parse(req.body);
      const booking = await AppointmentBookingService.bookAppointment({
        doctorId: validated.doctorId || null,
        organizationId: validated.organizationId || null,
        patientName: validated.patientName,
        patientAge: validated.patientAge,
        patientPhone: validated.patientPhone,
        patientEmail: validated.patientEmail,
        appointmentDate: validated.appointmentDate,
        timeSlot: validated.timeSlot,
        notes: validated.notes,
        source: validated.source || "WEBSITE_FORM",
      });

      res.status(201).json({
        success: true,
        message: "Appointment request submitted successfully",
        data: {
          appointment: booking.appointment,
          appointmentId: booking.appointmentId,
          tokenNumber: booking.tokenNumber,
          slotKey: booking.slotKey,
          timeSlot: booking.timeSlot,
          maxPatients: booking.maxPatients,
          bookedCount: booking.bookedCount,
          remainingSeats: booking.remainingSeats,
        },
      });
    } catch (error: any) {
      if (error?.status && error?.code) {
        res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
          data: {
            availableOptions: error.availableOptions,
            availableSlots: error.availableSlots,
          },
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/appointments/check-status
 * Public: Check appointment status using Appointment ID within the doctor/hospital website scope
 */
appointmentRouter.post(
  "/check-status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appointmentId, slug, doctorSlug } = req.body;

      if (!appointmentId || typeof appointmentId !== "string" || !appointmentId.trim()) {
        res.status(400).json({
          success: false,
          error: "Appointment ID is required",
          code: "INVALID_APPOINTMENT_ID",
        });
        return;
      }

      if (!slug || typeof slug !== "string") {
        res.status(400).json({
          success: false,
          error: "Website slug is required",
          code: "INVALID_SLUG",
        });
        return;
      }

      let cleanSlug = slug.trim().toLowerCase();
      let cleanDocSlug = doctorSlug ? String(doctorSlug).trim().toLowerCase() : undefined;

      if (cleanSlug.includes("/")) {
        const parts = cleanSlug.split("/").filter(Boolean);
        cleanSlug = parts[0] || cleanSlug;
        if (!cleanDocSlug && parts[1]) {
          cleanDocSlug = parts[1];
        }
      }

      const rawApptId = appointmentId.trim();
      const cleanApptId = rawApptId.toUpperCase();
      const idVariants: string[] = [rawApptId, cleanApptId];
      if (cleanApptId.startsWith("APT-")) {
        idVariants.push(cleanApptId.replace(/^APT-/, ""));
      } else {
        idVariants.push(`APT-${cleanApptId}`);
      }
      const uniqueVariants = Array.from(new Set(idVariants.filter(Boolean)));
      const apptIdCondition = uniqueVariants.length === 1 ? uniqueVariants[0] : { $in: uniqueVariants };
      let appointmentQuery: Record<string, unknown> | null = null;

      // 1. Hospital Doctor route (/:slug/:doctorSlug)
      if (cleanDocSlug) {
        const org = await Organization.findOne({ slug: cleanSlug });
        if (!org) {
          res.status(404).json({ success: false, error: "Hospital not found", code: "NOT_FOUND" });
          return;
        }
        const doc = await Doctor.findOne({ organizationId: org._id, slug: cleanDocSlug });
        if (!doc) {
          res.status(404).json({ success: false, error: "Doctor not found under this hospital", code: "NOT_FOUND" });
          return;
        }

        appointmentQuery = {
          appointmentId: apptIdCondition,
          organizationId: org._id,
          doctorId: doc._id,
        };
      } else {
        // 2. Single slug: Check Website or Doctor or Organization
        const website = await Website.findOne({ slug: cleanSlug });
        if (website) {
          if (website.websiteType === WebsiteType.ONLY_DOCTOR) {
            const doc = await Doctor.findById(website.doctorId || website.ownerId);
            if (!doc) {
              res.status(404).json({ success: false, error: "Doctor profile not found", code: "NOT_FOUND" });
              return;
            }
            appointmentQuery = {
              appointmentId: apptIdCondition,
              doctorId: doc._id,
              $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
            };
          } else if (website.websiteType === WebsiteType.HOSPITAL_CLINIC) {
            const org = await Organization.findById(website.organizationId || website.ownerId);
            if (!org) {
              res.status(404).json({ success: false, error: "Hospital not found", code: "NOT_FOUND" });
              return;
            }
            appointmentQuery = {
              appointmentId: apptIdCondition,
              organizationId: org._id,
            };
          }
        }

        if (!appointmentQuery) {
          // Direct doctor slug fallback
          const directDoc = await Doctor.findOne({ slug: cleanSlug });
          if (directDoc) {
            if (directDoc.organizationId) {
              // Hospital doctor direct slug -> query under that doctor and org
              appointmentQuery = {
                appointmentId: apptIdCondition,
                doctorId: directDoc._id,
                organizationId: directDoc.organizationId,
              };
            } else {
              // Autonomous doctor
              appointmentQuery = {
                appointmentId: apptIdCondition,
                doctorId: directDoc._id,
                $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
              };
            }
          } else {
            // Direct organization slug fallback
            const directOrg = await Organization.findOne({ slug: cleanSlug });
            if (directOrg) {
              appointmentQuery = {
                appointmentId: apptIdCondition,
                organizationId: directOrg._id,
              };
            }
          }
        }
      }

      if (!appointmentQuery) {
        res.status(404).json({
          success: false,
          error: "Healthcare practice website not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const appointment = await Appointment.findOne(appointmentQuery)
        .populate("doctorId", "doctorName specialization")
        .populate("organizationId", "name");

      if (!appointment) {
        res.status(404).json({
          success: false,
          error: `No appointment found with ID "${rawApptId}" for this doctor/hospital. Please check your Appointment ID.`,
          code: "APPOINTMENT_NOT_FOUND",
        });
        return;
      }

      const docObj = appointment.doctorId as any;
      const orgObj = appointment.organizationId as any;
      const queueInfo = await AppointmentBookingService.getAppointmentLiveQueueStatus(appointment);

      res.status(200).json({
        success: true,
        data: {
          appointmentId: appointment.appointmentId,
          tokenNumber: appointment.tokenNumber ?? null,
          slotKey: appointment.slotKey || queueInfo.slotKey,
          status: appointment.status,
          patientName: appointment.patientName,
          patientAge: appointment.patientAge,
          doctorName: docObj?.doctorName || "Doctor",
          doctorSpecialization: docObj?.specialization || "General Medicine",
          hospitalName: orgObj?.name || undefined,
          appointmentDate: appointment.appointmentDate,
          timeSlot: appointment.timeSlot,
          notes: appointment.notes,
          createdAt: appointment.createdAt,
          queueInfo,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/appointments/cancel
 * Public: Patient can cancel their own appointment using Appointment ID from the website
 */
appointmentRouter.post(
  "/cancel",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appointmentId, slug, doctorSlug, reason } = req.body;

      if (!appointmentId || typeof appointmentId !== "string" || !appointmentId.trim()) {
        res.status(400).json({
          success: false,
          error: "Appointment ID is required",
          code: "INVALID_APPOINTMENT_ID",
        });
        return;
      }

      if (!slug || typeof slug !== "string") {
        res.status(400).json({
          success: false,
          error: "Website slug is required",
          code: "INVALID_SLUG",
        });
        return;
      }

      let cleanSlug = slug.trim().toLowerCase();
      let cleanDocSlug = doctorSlug ? String(doctorSlug).trim().toLowerCase() : undefined;

      if (cleanSlug.includes("/")) {
        const parts = cleanSlug.split("/").filter(Boolean);
        cleanSlug = parts[0] || cleanSlug;
        if (!cleanDocSlug && parts[1]) {
          cleanDocSlug = parts[1];
        }
      }

      const rawApptId = appointmentId.trim();
      const cleanApptId = rawApptId.toUpperCase();
      const idVariants: string[] = [rawApptId, cleanApptId];
      if (cleanApptId.startsWith("APT-")) {
        idVariants.push(cleanApptId.replace(/^APT-/, ""));
      } else {
        idVariants.push(`APT-${cleanApptId}`);
      }
      const uniqueVariants = Array.from(new Set(idVariants.filter(Boolean)));
      const apptIdCondition = uniqueVariants.length === 1 ? uniqueVariants[0] : { $in: uniqueVariants };
      let appointmentQuery: Record<string, unknown> | null = null;

      // 1. Hospital Doctor route (/:slug/:doctorSlug)
      if (cleanDocSlug) {
        const org = await Organization.findOne({ slug: cleanSlug });
        if (!org) {
          res.status(404).json({ success: false, error: "Hospital not found", code: "NOT_FOUND" });
          return;
        }
        const doc = await Doctor.findOne({ organizationId: org._id, slug: cleanDocSlug });
        if (!doc) {
          res.status(404).json({ success: false, error: "Doctor not found under this hospital", code: "NOT_FOUND" });
          return;
        }

        appointmentQuery = {
          appointmentId: apptIdCondition,
          organizationId: org._id,
          doctorId: doc._id,
        };
      } else {
        // 2. Single slug: Check Website or Doctor or Organization
        const website = await Website.findOne({ slug: cleanSlug });
        if (website) {
          if (website.websiteType === WebsiteType.ONLY_DOCTOR) {
            const doc = await Doctor.findById(website.doctorId || website.ownerId);
            if (!doc) {
              res.status(404).json({ success: false, error: "Doctor profile not found", code: "NOT_FOUND" });
              return;
            }
            appointmentQuery = {
              appointmentId: apptIdCondition,
              doctorId: doc._id,
              $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
            };
          } else if (website.websiteType === WebsiteType.HOSPITAL_CLINIC) {
            const org = await Organization.findById(website.organizationId || website.ownerId);
            if (!org) {
              res.status(404).json({ success: false, error: "Hospital not found", code: "NOT_FOUND" });
              return;
            }
            appointmentQuery = {
              appointmentId: apptIdCondition,
              organizationId: org._id,
            };
          }
        }

        if (!appointmentQuery) {
          // Direct doctor slug fallback
          const directDoc = await Doctor.findOne({ slug: cleanSlug });
          if (directDoc) {
            if (directDoc.organizationId) {
              appointmentQuery = {
                appointmentId: apptIdCondition,
                doctorId: directDoc._id,
                organizationId: directDoc.organizationId,
              };
            } else {
              appointmentQuery = {
                appointmentId: apptIdCondition,
                doctorId: directDoc._id,
                $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
              };
            }
          } else {
            // Direct organization slug fallback
            const directOrg = await Organization.findOne({ slug: cleanSlug });
            if (directOrg) {
              appointmentQuery = {
                appointmentId: apptIdCondition,
                organizationId: directOrg._id,
              };
            }
          }
        }
      }

      if (!appointmentQuery) {
        res.status(404).json({
          success: false,
          error: "Healthcare practice website not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const appointment = await Appointment.findOne(appointmentQuery);
      if (!appointment) {
        res.status(404).json({
          success: false,
          error: `No appointment found with ID "${rawApptId}" for this doctor/hospital.`,
          code: "APPOINTMENT_NOT_FOUND",
        });
        return;
      }

      if (appointment.status === "CANCELLED") {
        res.status(400).json({
          success: false,
          error: "This appointment is already cancelled and cannot be modified.",
          code: "ALREADY_CANCELLED",
        });
        return;
      }

      if (appointment.status === "COMPLETED") {
        res.status(400).json({
          success: false,
          error: "Completed appointments cannot be cancelled.",
          code: "ALREADY_COMPLETED",
        });
        return;
      }

      const previousStatus = appointment.status;
      await AppointmentBookingService.releaseSlotOnCancellation(appointment, "PATIENT");

      await logAuditEvent({
        userId: null,
        userEmail: appointment.patientEmail || appointment.patientPhone,
        action: "APPOINTMENT_CANCELLED_BY_PATIENT",
        entityType: "Appointment",
        entityId: appointment._id.toString(),
        organizationId: appointment.organizationId ? appointment.organizationId.toString() : null,
        doctorId: appointment.doctorId.toString(),
        details: {
          previousStatus,
          newStatus: "CANCELLED",
          patientName: appointment.patientName,
          appointmentId: appointment.appointmentId,
          tokenNumber: appointment.tokenNumber,
          reason: reason || "Cancelled by patient via website status portal",
        },
      });

      res.status(200).json({
        success: true,
        message: "Your appointment has been cancelled successfully.",
        data: {
          appointmentId: appointment.appointmentId,
          status: "CANCELLED",
        },
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

        // Strict boundary: Resolve doctors belonging to this hospital only
        const hospitalDocs = await Doctor.find({ organizationId: user.organizationId }).select("_id").lean();
        const hospitalDocIds = hospitalDocs.map((d) => d._id);

        if (doctorId) {
          const belongs = hospitalDocIds.some((id) => id.toString() === doctorId.toString());
          if (!belongs) {
            res.status(403).json({
              success: false,
              error: "Forbidden: You cannot view appointments of a doctor outside your hospital",
              code: "FORBIDDEN",
            });
            return;
          }
          filter.doctorId = doctorId;
          filter.organizationId = user.organizationId;
        } else {
          filter.$or = [
            { organizationId: user.organizationId },
            { doctorId: { $in: hospitalDocIds } },
          ];
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(403).json({ success: false, error: "Doctor user missing profile link", code: "FORBIDDEN" });
          return;
        }
        // Strict boundary: Hospital Doctor sees ONLY their own appointments
        filter.doctorId = user.doctorProfileId;
        if (user.organizationId) {
          filter.organizationId = user.organizationId;
        }
      } else if (user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(403).json({ success: false, error: "Doctor user missing profile link", code: "FORBIDDEN" });
          return;
        }
        // Strict boundary: Only Doctor sees ONLY their own appointments and NEVER any hospital appointments
        filter.doctorId = user.doctorProfileId;
        filter.$or = [{ organizationId: null }, { organizationId: { $exists: false } }];
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
 * GET /api/v1/appointments/queue
 * Authenticated: Live OPD Queue & Slot capacity overview for Doctor / Hospital Admin
 */
appointmentRouter.get(
  "/queue",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const requestedDoctorId =
        typeof req.query.doctorId === "string" ? req.query.doctorId : undefined;
      const dateStr = typeof req.query.date === "string" ? req.query.date : undefined;
      const slotKey = typeof req.query.slotKey === "string" ? req.query.slotKey : undefined;

      let targetDoctorId = "";
      if (user.role === UserRole.SUPERADMIN) {
        targetDoctorId = requestedDoctorId || "";
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId) {
          res.status(403).json({ success: false, error: "Forbidden", code: "FORBIDDEN" });
          return;
        }
        if (requestedDoctorId) {
          const doc = await Doctor.findOne({
            _id: requestedDoctorId,
            organizationId: user.organizationId,
          }).select("_id");
          if (!doc) {
            res.status(403).json({
              success: false,
              error: "Forbidden: Doctor does not belong to your hospital",
              code: "FORBIDDEN",
            });
            return;
          }
          targetDoctorId = doc._id.toString();
        } else {
          const firstDoc = await Doctor.findOne({ organizationId: user.organizationId })
            .select("_id")
            .lean();
          targetDoctorId = firstDoc ? firstDoc._id.toString() : "";
        }
      } else if (
        user.role === UserRole.ONLY_DOCTOR ||
        user.role === UserRole.HOSPITAL_DOCTOR
      ) {
        targetDoctorId = user.doctorProfileId ? user.doctorProfileId.toString() : "";
      }

      if (!targetDoctorId) {
        res.status(400).json({
          success: false,
          error: "Doctor profile is required to view OPD queue",
          code: "DOCTOR_REQUIRED",
        });
        return;
      }

      const summary = await AppointmentBookingService.getLiveQueueSummary({
        doctorId: targetDoctorId,
        dateStr,
        slotKey,
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/appointments/queue/next
 * Authenticated: Call Next Patient / Advance Live OPD Queue Token
 */
appointmentRouter.post(
  "/queue/next",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { doctorId: bodyDoctorId, date, slotKey, completeCurrent } = req.body || {};

      let targetDoctorId = "";
      if (user.role === UserRole.SUPERADMIN) {
        targetDoctorId = bodyDoctorId || "";
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || !bodyDoctorId) {
          res.status(403).json({ success: false, error: "Hospital Doctor ID required", code: "FORBIDDEN" });
          return;
        }
        const doc = await Doctor.findOne({
          _id: bodyDoctorId,
          organizationId: user.organizationId,
        }).select("_id");
        if (!doc) {
          res.status(403).json({
            success: false,
            error: "Forbidden: Doctor does not belong to your hospital",
            code: "FORBIDDEN",
          });
          return;
        }
        targetDoctorId = doc._id.toString();
      } else if (
        user.role === UserRole.ONLY_DOCTOR ||
        user.role === UserRole.HOSPITAL_DOCTOR
      ) {
        targetDoctorId = user.doctorProfileId ? user.doctorProfileId.toString() : "";
      }

      if (!targetDoctorId) {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const updated = await AppointmentBookingService.callNextToken({
        doctorId: targetDoctorId,
        dateStr: typeof date === "string" ? date : undefined,
        slotKey: typeof slotKey === "string" ? slotKey : undefined,
        completeCurrent: completeCurrent !== false,
        actor: { userId: user.userId, email: user.email, role: user.role },
      });

      res.status(200).json({
        success: true,
        message: updated.currentServingToken > 0
          ? `Now serving Token #${updated.currentServingToken}`
          : "Queue completed for selected slot",
        data: updated,
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
      const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "PATIENT_NOT_COME"];
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
        let isAuthorized = false;
        if (user.organizationId && appointment.organizationId?.toString() === user.organizationId.toString()) {
          isAuthorized = true;
        } else if (user.organizationId && appointment.doctorId) {
          const doc = await Doctor.findOne({ _id: appointment.doctorId, organizationId: user.organizationId });
          if (doc) isAuthorized = true;
        }

        if (!isAuthorized) {
          res.status(403).json({
            success: false,
            error: "Forbidden: Not an appointment for your hospital organization",
            code: "FORBIDDEN",
          });
          return;
        }
      } else if (user.role === UserRole.ONLY_DOCTOR) {
        if (
          !user.doctorProfileId ||
          appointment.doctorId.toString() !== user.doctorProfileId.toString() ||
          appointment.organizationId
        ) {
          res.status(403).json({
            success: false,
            error: "Forbidden: You can only manage your own patient appointments",
            code: "FORBIDDEN",
          });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
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

      // Permanent lock: Once cancelled, cannot be reactivated or changed to any other status
      if (appointment.status === "CANCELLED") {
        res.status(400).json({
          success: false,
          error: "Cancelled appointments are permanently locked and cannot be modified or reactivated.",
          code: "APPOINTMENT_ALREADY_CANCELLED",
        });
        return;
      }

      const previousStatus = appointment.status;
      if (status === "CANCELLED") {
        await AppointmentBookingService.releaseSlotOnCancellation(appointment, user.role);
      } else {
        appointment.status = status;
        await appointment.save();
        if (status === "COMPLETED" || status === "PATIENT_NOT_COME") {
          await AppointmentBookingService.syncQueueAfterManualStatusFinish(appointment);
        }
      }

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
        let isAuthorized = false;
        if (user.organizationId && appointment.organizationId?.toString() === user.organizationId.toString()) {
          isAuthorized = true;
        } else if (user.organizationId && appointment.doctorId) {
          const doc = await Doctor.findOne({ _id: appointment.doctorId, organizationId: user.organizationId });
          if (doc) isAuthorized = true;
        }
        if (!isAuthorized) {
          res.status(403).json({ success: false, error: "Forbidden: Not an appointment for your hospital organization", code: "FORBIDDEN" });
          return;
        }
      } else if (user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId || appointment.doctorId.toString() !== user.doctorProfileId.toString() || appointment.organizationId) {
          res.status(403).json({ success: false, error: "Forbidden: You can only delete your own appointments", code: "FORBIDDEN" });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
        if (!user.doctorProfileId || appointment.doctorId.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden: You can only delete your own appointments", code: "FORBIDDEN" });
          return;
        }
      }

      if (appointment.status !== "CANCELLED") {
        const dateKey = normalizeDateKey(appointment.appointmentDate);
        const slotKey = appointment.slotKey || inferSlotKeyFromLabel(appointment.timeSlot);
        await SlotCounter.updateOne(
          { doctorId: appointment.doctorId, dateKey, slotKey, activeCount: { $gt: 0 } },
          { $inc: { activeCount: -1 } }
        ).catch(() => {});
      }

      await Appointment.findByIdAndDelete(req.params.id);

      await logAuditEvent({
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        action: "APPOINTMENT_DELETED",
        entityType: "Appointment",
        entityId: appointment._id.toString(),
        organizationId: appointment.organizationId ? appointment.organizationId.toString() : null,
        doctorId: appointment.doctorId.toString(),
        details: { patientName: appointment.patientName, patientPhone: appointment.patientPhone },
      });

      res.status(200).json({
        success: true,
        message: "Appointment permanently deleted from database",
        data: { appointmentId: appointment._id },
      });
    } catch (error) {
      next(error);
    }
  }
);
