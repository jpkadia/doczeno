import { Organization, IOrganization } from "@/models";
import { logAuditEvent } from "./audit.service";
import { AuthUserPayload } from "@/types";

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
    const updated = await Organization.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

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
