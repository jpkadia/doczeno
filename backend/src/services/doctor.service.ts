import { Doctor, IDoctor } from "@/models";
import { logAuditEvent } from "./audit.service";
import { AuthUserPayload } from "@/types";

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
    return Doctor.findById(id);
  }

  static async getBySlug(slug: string): Promise<IDoctor | null> {
    return Doctor.findOne({ slug: slug.toLowerCase() });
  }

  static async updateDoctor(
    id: string,
    updateData: Partial<IDoctor>,
    actor?: AuthUserPayload
  ): Promise<IDoctor | null> {
    const updated = await Doctor.findByIdAndUpdate(
      id,
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
