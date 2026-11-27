import { Organization, IOrganization, Doctor, Website, Media } from "@/models";
import { logAuditEvent } from "./audit.service";
import { MediaService } from "./media.service";
import { aiContentService, resolveOrganizationSpecialties } from "./ai-content.service";
import { AuthUserPayload } from "@/types";
import { RESERVED_SLUGS } from "@/constants/healthcare";

export class OrganizationService {
  static async createOrganization(
    data: Partial<IOrganization>,
    actor?: AuthUserPayload
  ): Promise<IOrganization> {
    const org = await Organization.create(data);

    if (actor) {
      await logAuditEvent({
        userId: actor.userId,
        userEmail: actor.email,
        userRole: actor.role,
        action: "ORGANIZATION_CREATED",
        entityType: "Organization",
        entityId: org._id.toString(),
        organizationId: org._id.toString(),
        details: { name: org.name, slug: org.slug },
      });
    }

    return org;
  }

  static async getById(id: string): Promise<IOrganization | null> {
    return Organization.findById(id);
  }

  static async getBySlug(slug: string): Promise<IOrganization | null> {
    return Organization.findOne({ slug: slug.toLowerCase() });
  }

  static async updateOrganization(
    id: string,
    updateData: Partial<IOrganization>,
    actor?: AuthUserPayload
  ): Promise<IOrganization | null> {
    const existingOrg = await Organization.findById(id);
    if (!existingOrg) return null;

    // Keep specialties and departments strictly synchronized (minimum 1 specialty required)
    const incomingSpecs =
      Array.isArray(updateData.specialties) || Array.isArray(updateData.departments)
        ? resolveOrganizationSpecialties({
            specialties: updateData.specialties,
            departments: updateData.departments,
          })
        : null;

    if (incomingSpecs !== null) {
      if (incomingSpecs.length === 0) {
        throw new Error("At least 1 medical specialty / department is required for a hospital or clinic.");
      }
      updateData.specialties = incomingSpecs;
      updateData.departments = incomingSpecs;
    }

    if (updateData.slug && typeof updateData.slug === "string") {
      const newSlug = updateData.slug.trim().toLowerCase().replace(/^-+|-+$/g, "");
      if (newSlug !== existingOrg.slug) {
        if (newSlug.length < 2 || newSlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
          throw new Error("Invalid slug format. Must be 2-60 lowercase alphanumeric characters and single hyphens.");
        }
        if (RESERVED_SLUGS.includes(newSlug as any)) {
          throw new Error("This URL identifier is reserved and cannot be used.");
        }

        const [existingOtherOrg, existingWebsite, existingDoc] = await Promise.all([
          Organization.findOne({ slug: newSlug, _id: { $ne: existingOrg._id } }),
          Website.findOne({ slug: newSlug, organizationId: { $ne: existingOrg._id } }),
          Doctor.findOne({ organizationId: null, slug: newSlug }),
        ]);

        if (existingOtherOrg || existingWebsite || existingDoc) {
          throw new Error("This website URL slug is already taken. Please choose another.");
        }

        updateData.slug = newSlug;

        // Update hospital's website record
        await Website.findOneAndUpdate(
          { organizationId: existingOrg._id, websiteType: "HOSPITAL_CLINIC" },
          { $set: { slug: newSlug } }
        );

        // Cascade update to all affiliated doctors' website records
        const childDoctors = await Doctor.find({ organizationId: existingOrg._id });
        for (const childDoc of childDoctors) {
          await Website.findOneAndUpdate(
            { doctorId: childDoc._id, organizationId: existingOrg._id },
            { $set: { slug: `${newSlug}-${childDoc.slug}` } }
          );
        }
      }
    }

    // Building photo replacement: Clean up old photo permanently from Cloudinary & Media collection
    if (
      updateData.buildingPhoto &&
      updateData.buildingPhoto.publicId &&
      existingOrg.buildingPhoto &&
      existingOrg.buildingPhoto.publicId &&
      updateData.buildingPhoto.publicId !== existingOrg.buildingPhoto.publicId
    ) {
      const oldPublicId = existingOrg.buildingPhoto.publicId;
      await MediaService.destroyCloudinaryAsset(oldPublicId);
      await Media.deleteMany({ publicId: oldPublicId });
    }

    if (updateData.buildingPhoto && updateData.buildingPhoto.publicId) {
      await MediaService.markMediaAsAttached([updateData.buildingPhoto], existingOrg._id, "ORGANIZATION");
    }

    const updated = await Organization.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (updated && incomingSpecs !== null) {
      await aiContentService.syncHospitalSpecialtiesToContent(
        updated._id,
        updated.specialties || incomingSpecs,
        updated.address?.city
      );
    }

    if (updated && actor) {
      await logAuditEvent({
        userId: actor.userId,
        userEmail: actor.email,
        userRole: actor.role,
        action: "ORGANIZATION_UPDATED",
        entityType: "Organization",
        entityId: id,
        organizationId: id,
        details: updateData as Record<string, unknown>,
      });
    }

    return updated;
  }

  static async listOrganizations(query: {
    status?: string;
    city?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ organizations: IOrganization[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.city) filter["address.city"] = new RegExp(`^${query.city}$`, "i");

    const limit = query.limit || 20;
    const skip = query.skip || 0;

    const [organizations, total] = await Promise.all([
      Organization.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Organization.countDocuments(filter),
    ]);

    return { organizations, total };
  }
}
