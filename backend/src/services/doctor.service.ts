import mongoose from "mongoose";
import { Doctor, IDoctor, Organization, Website, Media } from "@/models";
import { logAuditEvent } from "./audit.service";
import { MediaService } from "./media.service";
import { AuthUserPayload } from "@/types";
import { RESERVED_SLUGS } from "@/constants/healthcare";

export class DoctorService {
  static async createDoctor(
    data: Partial<IDoctor>,
    actor?: AuthUserPayload
  ): Promise<IDoctor> {
    const doctor = await Doctor.create(data);

    if (actor) {
      await logAuditEvent({
        userId: actor.userId,
        userEmail: actor.email,
        userRole: actor.role,
        action: "DOCTOR_CREATED",
        entityType: "Doctor",
        entityId: doctor._id.toString(),
        organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
        doctorId: doctor._id.toString(),
        details: { doctorName: doctor.doctorName, slug: doctor.slug },
      });
    }

    return doctor;
  }

  static async getById(id: string): Promise<IDoctor | null> {
    if (mongoose.Types.ObjectId.isValid(id)) {
      const doc = await Doctor.findById(id);
      if (doc) return doc;
    }
    return Doctor.findOne({ slug: id.toLowerCase() });
  }

  static async getBySlug(slug: string): Promise<IDoctor | null> {
    return Doctor.findOne({ slug: slug.toLowerCase() });
  }

  static async updateDoctor(
    id: string,
    updateData: Partial<IDoctor>,
    actor?: AuthUserPayload
  ): Promise<IDoctor | null> {
    let query: any = { _id: id };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      query = { slug: id.toLowerCase() };
    }

    const existing = await Doctor.findOne(query);
    if (!existing) return null;

    if (updateData.slug && typeof updateData.slug === "string") {
      const newSlug = updateData.slug.trim().toLowerCase().replace(/^-+|-+$/g, "");
      if (newSlug !== existing.slug) {
        if (newSlug.length < 2 || newSlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
          throw new Error("Invalid slug format. Must be 2-60 lowercase alphanumeric characters and single hyphens.");
        }
        if (RESERVED_SLUGS.includes(newSlug as any)) {
          throw new Error("This URL identifier is reserved and cannot be used.");
        }

        if (existing.organizationId) {
          // Scoped under parent hospital
          const duplicate = await Doctor.findOne({
            organizationId: existing.organizationId,
            slug: newSlug,
            _id: { $ne: existing._id },
          });
          if (duplicate) {
            throw new Error("This doctor URL slug is already taken in this hospital.");
          }

          const parentOrg = await Organization.findById(existing.organizationId);
          const parentSlug = parentOrg?.slug || "";
          const childWebSlug = parentSlug ? `${parentSlug}-${newSlug}` : newSlug;

          updateData.slug = newSlug;
          await Website.updateMany(
            { doctorId: existing._id },
            { $set: { slug: childWebSlug } }
          );
        } else {
          // Autonomous / Only Doctor root slug
          const [existingOrg, existingWebsite, existingDoc] = await Promise.all([
            Organization.findOne({ slug: newSlug }),
            Website.findOne({ slug: newSlug, doctorId: { $ne: existing._id } }),
            Doctor.findOne({ organizationId: null, slug: newSlug, _id: { $ne: existing._id } }),
          ]);
          if (existingOrg || existingWebsite || existingDoc) {
            throw new Error("This website URL slug is already taken. Please choose another.");
          }

          updateData.slug = newSlug;
          await Website.updateMany(
            { doctorId: existing._id },
            { $set: { slug: newSlug } }
          );
        }
      }
    }

    // Doctor photo replacement: Clean up old photo permanently from Cloudinary & Media collection
    if (
      updateData.doctorPhoto &&
      updateData.doctorPhoto.publicId &&
      existing.doctorPhoto &&
      existing.doctorPhoto.publicId &&
      updateData.doctorPhoto.publicId !== existing.doctorPhoto.publicId
    ) {
      const oldPublicId = existing.doctorPhoto.publicId;
      await MediaService.destroyCloudinaryAsset(oldPublicId);
      await Media.deleteMany({ publicId: oldPublicId });
    }

    // Mark newly attached doctorPhoto as attached in Media collection
    if (updateData.doctorPhoto && updateData.doctorPhoto.publicId) {
      await MediaService.markMediaAsAttached([updateData.doctorPhoto], existing._id, "DOCTOR");
    }

    // Disallow deleting/emptying doctorPhoto (doctor photo can only be replaced, never emptied)
    if (
      updateData.doctorPhoto === null ||
      (typeof updateData.doctorPhoto === "object" && !updateData.doctorPhoto?.url && !updateData.doctorPhoto?.publicId)
    ) {
      delete updateData.doctorPhoto;
    }

    // Validate hospital doctor consultation schedule against parent hospital's operational hours / weekly off
    if (existing.organizationId && updateData.consultationHours) {
      const parentOrg = await Organization.findById(existing.organizationId);
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
              throw new Error(
                `Doctor cannot set consultation hours on ${sched.day} because ${parentOrg.name} is closed on this day (Hospital Weekly Off).`
              );
            }
          }
        }
      }
    }

    const updated = await Doctor.findOneAndUpdate(
      { _id: existing._id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (updated && actor) {
      await logAuditEvent({
        userId: actor.userId,
        userEmail: actor.email,
        userRole: actor.role,
        action: "DOCTOR_UPDATED",
        entityType: "Doctor",
        entityId: id,
        organizationId: updated.organizationId ? updated.organizationId.toString() : null,
        doctorId: id,
        details: updateData as Record<string, unknown>,
      });
    }

    return updated;
  }

  static async listDoctors(query: {
    organizationId?: string;
    specialization?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ doctors: IDoctor[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.organizationId) filter.organizationId = query.organizationId;
    if (query.specialization) filter.specialization = query.specialization;
    if (query.status) filter.status = query.status;

    const limit = query.limit || 20;
    const skip = query.skip || 0;

    const [doctors, total] = await Promise.all([
      Doctor.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Doctor.countDocuments(filter),
    ]);

    return { doctors, total };
  }
}
