import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DoctorService } from "@/services/doctor.service";
import { MediaService } from "@/services/media.service";
import { doctorCreateSchema, doctorUpdateSchema } from "@/validations";
import { requireAuthenticatedUser } from "@/middleware/auth";
import {
  requireRole,
  requireDoctorAccess,
  preventHospitalDoctorInheritedFieldMutation,
} from "@/middleware/rbac";
import { UserRole } from "@/types";
import {
  Organization,
  Website,
  Doctor,
  User,
  AIContent,
  Media,
  Appointment,
  ChatbotConversation,
} from "@/models";
import { logAuditEvent } from "@/services/audit.service";
import { RESERVED_SLUGS } from "@/constants/healthcare";

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
            workingHours: parentOrg.workingHours,
            weeklyOff: parentOrg.weeklyOff,
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
 * PATCH /api/v1/doctors/me
 * Authenticated: Updates current doctor's profile and theme (for independent doctors)
 * Enforces rule: Hospital-affiliated doctors CANNOT change theme. Theme is strictly inherited from hospital.
 */
doctorRouter.patch(
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

      const updateData = req.body;

      // Strict validation: Hospital-affiliated doctors cannot change theme
      if (doctor.organizationId && updateData.selectedTheme) {
        res.status(403).json({
          success: false,
          error: "Hospital-affiliated doctors cannot change website theme. The theme is automatically inherited from your hospital.",
          code: "THEME_INHERITED_FROM_HOSPITAL",
        });
        return;
      }

      // Independent doctor: Update theme in Website record
      if (!doctor.organizationId && updateData.selectedTheme) {
        await Website.updateMany(
          { doctorId: doctor._id },
          { $set: { templateId: updateData.selectedTheme } }
        );
      }

      // Sync SEO and branding with Website record
      if (updateData.browserTabTitle || updateData.faviconUrl) {
        const seoUpdates: Record<string, unknown> = {};
        if (updateData.browserTabTitle) {
          seoUpdates["browserTabTitle"] = updateData.browserTabTitle;
          seoUpdates["seoMetadata.title"] = updateData.browserTabTitle;
        }
        if (updateData.faviconUrl) {
          seoUpdates["faviconUrl"] = updateData.faviconUrl;
          seoUpdates["seoMetadata.ogImage"] = updateData.faviconUrl;
        }
        await Website.updateMany({ doctorId: doctor._id }, { $set: seoUpdates });
      }

      // Slug customization update
      if (updateData.slug && typeof updateData.slug === "string") {
        const newSlug = updateData.slug.trim().toLowerCase().replace(/^-+|-+$/g, "");
        if (newSlug !== doctor.slug) {
          if (newSlug.length < 2 || newSlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
            res.status(400).json({
              success: false,
              error: "Invalid slug format. Must be 2-60 lowercase alphanumeric characters and single hyphens.",
              code: "INVALID_SLUG",
            });
            return;
          }
          if (RESERVED_SLUGS.includes(newSlug as any)) {
            res.status(400).json({
              success: false,
              error: "This URL identifier is reserved and cannot be used.",
              code: "RESERVED_SLUG",
            });
            return;
          }

          if (doctor.organizationId) {
            // Scoped doctor under parent hospital
            const duplicate = await Doctor.findOne({
              organizationId: doctor.organizationId,
              slug: newSlug,
              _id: { $ne: doctor._id },
            });
            if (duplicate) {
              res.status(409).json({
                success: false,
                error: "This doctor URL slug is already taken in this hospital.",
                code: "SLUG_ALREADY_EXISTS",
              });
              return;
            }

            const parentOrg = await Organization.findById(doctor.organizationId);
            const parentSlug = parentOrg?.slug || "";
            const childWebSlug = parentSlug ? `${parentSlug}-${newSlug}` : newSlug;

            doctor.slug = newSlug;
            await Website.updateMany(
              { doctorId: doctor._id },
              { $set: { slug: childWebSlug } }
            );
          } else {
            // Autonomous / Only Doctor root slug
            const [existingOrg, existingWebsite, existingDoc] = await Promise.all([
              Organization.findOne({ slug: newSlug }),
              Website.findOne({ slug: newSlug, doctorId: { $ne: doctor._id } }),
              Doctor.findOne({ organizationId: null, slug: newSlug, _id: { $ne: doctor._id } }),
            ]);
            if (existingOrg || existingWebsite || existingDoc) {
              res.status(409).json({
                success: false,
                error: "This website URL slug is already taken. Please choose another.",
                code: "SLUG_ALREADY_EXISTS",
              });
              return;
            }

            doctor.slug = newSlug;
            await Website.updateMany(
              { doctorId: doctor._id },
              { $set: { slug: newSlug } }
            );
          }
        }
      }

      // Doctor photo replacement: Clean up old photo permanently from Cloudinary & Media collection
      if (
        updateData.doctorPhoto &&
        updateData.doctorPhoto.publicId &&
        doctor.doctorPhoto &&
        doctor.doctorPhoto.publicId &&
        updateData.doctorPhoto.publicId !== doctor.doctorPhoto.publicId
      ) {
        const oldPublicId = doctor.doctorPhoto.publicId;
        await MediaService.destroyCloudinaryAsset(oldPublicId);
        await Media.deleteMany({ publicId: oldPublicId });
      }

      // Mark newly attached doctorPhoto as attached in Media collection
      if (updateData.doctorPhoto && updateData.doctorPhoto.publicId) {
        await MediaService.markMediaAsAttached([updateData.doctorPhoto], doctor._id, "DOCTOR");
      }

      // Disallow deleting/emptying doctorPhoto (doctor photo can only be replaced, never emptied)
      if (
        updateData.doctorPhoto === null ||
        (typeof updateData.doctorPhoto === "object" && !updateData.doctorPhoto?.url && !updateData.doctorPhoto?.publicId)
      ) {
        delete updateData.doctorPhoto;
      }

      // Validate hospital doctor consultation schedule against parent hospital's operational hours / weekly off
      if (doctor.organizationId && updateData.consultationHours) {
        const parentOrg = await Organization.findById(doctor.organizationId);
        if (parentOrg) {
          const hospitalOffDays = new Set<string>();
          if (parentOrg.weeklyOff) {
            parentOrg.weeklyOff
              .split(",")
              .map((d: string) => d.trim().toLowerCase())
              .filter(Boolean)
              .forEach((d: string) => hospitalOffDays.add(d));
          }
          if (parentOrg.workingHours) {
            try {
              const parsed = JSON.parse(parentOrg.workingHours);
              if (Array.isArray(parsed)) {
                parsed.forEach((s: any) => {
                  if (s.isClosed && s.day) hospitalOffDays.add(String(s.day).trim().toLowerCase());
                });
              }
            } catch {}
          }

          if (hospitalOffDays.size > 0) {
            let schedules: any[] = [];
            if (typeof updateData.consultationHours === "string") {
              try {
                schedules = JSON.parse(updateData.consultationHours);
              } catch {}
            } else if (Array.isArray(updateData.consultationHours)) {
              schedules = updateData.consultationHours;
            }

            for (const sched of schedules) {
              if (!sched.isClosed && sched.day && hospitalOffDays.has(String(sched.day).trim().toLowerCase())) {
                res.status(400).json({
                  success: false,
                  error: `Doctor cannot set consultation hours on ${sched.day} because ${parentOrg.name} is closed on this day (Hospital Weekly Off).`,
                  code: "HOSPITAL_CLOSED_ON_SELECTED_DAY",
                });
                return;
              }
            }
          }
        }
      }

      // Update doctor fields (excluding restricted organizationId or raw id tampering)
      delete updateData.organizationId;
      delete updateData.slug;
      delete updateData._id;

      Object.assign(doctor, updateData);
      await doctor.save();

      await logAuditEvent({
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        action: "DOCTOR_UPDATED",
        entityType: "Doctor",
        entityId: doctor._id.toString(),
        organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
        doctorId: doctor._id.toString(),
        details: { fields: Object.keys(updateData) },
      });

      res.status(200).json({
        success: true,
        message: "Doctor profile and website settings updated successfully",
        data: { doctor },
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
            workingHours: parentOrg.workingHours,
            weeklyOff: parentOrg.weeklyOff,
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
 * Protected: Register doctor under a hospital or as only doctor
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

doctorRouter.patch(
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

      let doctor: any = null;
      const paramId = String(req.params.id || "");
      if (mongoose.Types.ObjectId.isValid(paramId)) {
        doctor = await Doctor.findById(paramId);
      }
      if (!doctor) {
        doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
      }
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
      let doctor: any = null;
      const paramId = String(req.params.id || "");
      if (mongoose.Types.ObjectId.isValid(paramId)) {
        doctor = await Doctor.findById(paramId);
      }
      if (!doctor) {
        doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
      }
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      const isPermanent = req.query.permanent === "true" || req.body?.permanent === true;

      if (isPermanent) {
        // Strict boundary: Only Superadmin or the parent Hospital Admin can permanently delete a hospital doctor.
        // Hospital Admin CANNOT permanently delete an Only Doctor (organizationId is null).
        if (req.user!.role === UserRole.HOSPITAL_ADMIN) {
          if (!doctor.organizationId || doctor.organizationId.toString() !== req.user!.organizationId?.toString()) {
            res.status(403).json({
              success: false,
              error: "Forbidden: Hospital admins can only permanently delete doctors belonging to their hospital",
              code: "FORBIDDEN",
            });
            return;
          }
        } else if (req.user!.role !== UserRole.SUPERADMIN) {
          res.status(403).json({
            success: false,
            error: "Forbidden: Insufficient permissions to permanently delete this doctor",
            code: "FORBIDDEN",
          });
          return;
        }

        // 1. Delete doctor record
        await Doctor.findByIdAndDelete(doctor._id);

        // 2. Delete doctor website record
        await Website.deleteMany({ doctorId: doctor._id });

        // 3. Delete user account associated with doctor
        await User.deleteMany({ doctorProfileId: doctor._id });

        // 4. Delete AI Content records
        await AIContent.deleteMany({ targetId: doctor._id.toString() });

        // 5. Delete Media assets and destroy Cloudinary assets
        if (doctor.doctorPhoto?.publicId) {
          await MediaService.destroyCloudinaryAsset(doctor.doctorPhoto.publicId);
        }
        if (Array.isArray(doctor.clinicPhotos)) {
          for (const p of doctor.clinicPhotos) {
            if (p?.publicId) {
              await MediaService.destroyCloudinaryAsset(p.publicId);
            }
          }
        }
        await Media.deleteMany({
          $or: [
            { doctorId: doctor._id },
            { ownerId: doctor._id.toString() },
            { attachedEntityId: doctor._id },
          ],
        });

        // 6. Delete Appointments
        await Appointment.deleteMany({ doctorId: doctor._id });

        // 7. Delete Chatbot conversations
        await ChatbotConversation.deleteMany({ doctorId: doctor._id });

        await logAuditEvent({
          userId: req.user!.userId,
          userEmail: req.user!.email,
          userRole: req.user!.role,
          action: "DOCTOR_PERMANENTLY_DELETED",
          entityType: "Doctor",
          entityId: doctor._id.toString(),
          organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
          doctorId: doctor._id.toString(),
          details: { doctorName: doctor.doctorName, permanent: true },
        });

        res.status(200).json({
          success: true,
          message: "Doctor and affiliated website permanently deleted successfully",
          data: { doctorId: doctor._id },
        });
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
