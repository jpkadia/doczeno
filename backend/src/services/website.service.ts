import { Website, IWebsite, Doctor, Organization } from "@/models";
import { WebsiteType, EffectiveWebsiteData } from "@/types";
import { logAuditEvent } from "./audit.service";
import { AuthUserPayload } from "@/types";

export class WebsiteService {
  static async createWebsite(
    data: Partial<IWebsite>,
    actor?: AuthUserPayload
  ): Promise<IWebsite> {
    const website = await Website.create(data);

    if (actor) {
      await logAuditEvent({
        userId: actor.userId,
        userEmail: actor.email,
        userRole: actor.role,
        action: "WEBSITE_CREATED",
        entityType: "Website",
        entityId: website._id.toString(),
        organizationId: website.organizationId ? website.organizationId.toString() : null,
        doctorId: website.doctorId ? website.doctorId.toString() : null,
        details: { slug: website.slug, websiteType: website.websiteType },
      });
    }

    return website;
  }

  static async getById(id: string): Promise<IWebsite | null> {
    return Website.findById(id);
  }

  static async getBySlug(slug: string): Promise<IWebsite | null> {
    return Website.findOne({ slug: slug.toLowerCase() });
  }

  /**
   * Runtime Data Inheritance Engine
   * Resolves public website data dynamically.
   * For Hospital Doctors, runtime inherits organization branding, address, theme, favicon, and tab title.
   * Never stores or duplicates inherited hospital fields into the doctor document.
   */
  static async resolveEffectiveWebsiteData(
    slug: string
  ): Promise<EffectiveWebsiteData | null> {
    const website = await Website.findOne({ slug: slug.toLowerCase() });
    if (!website) return null;

    if (website.websiteType === WebsiteType.HOSPITAL_CLINIC) {
      const org = await Organization.findById(website.organizationId || website.ownerId);
      if (!org) return null;

      return {
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        slug: website.slug,
        organizationName: org.name,
        logo: org.logo,
        galleryPhotos: org.galleryPhotos,
        address: org.address,
        selectedTheme: org.selectedTheme,
        faviconUrl: org.faviconUrl,
        browserTabTitle: org.browserTabTitle,
        isHospitalChild: false,
      };
    }

    if (website.websiteType === WebsiteType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor || !doctor.organizationId) return null;

      // Fetch parent organization dynamically as source of truth
      const parentOrg = await Organization.findById(doctor.organizationId);
      if (!parentOrg) return null;

      return {
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        slug: website.slug,
        // Inherited from parent Hospital (runtime source of truth):
        organizationName: parentOrg.name,
        logo: parentOrg.logo,
        galleryPhotos: parentOrg.galleryPhotos,
        address: parentOrg.address,
        selectedTheme: parentOrg.selectedTheme,
        faviconUrl: parentOrg.faviconUrl,
        browserTabTitle: parentOrg.browserTabTitle,
        // Doctor specific attributes:
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: true,
        hospitalSlug: parentOrg.slug,
      };
    }

    if (website.websiteType === WebsiteType.INDEPENDENT_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor) return null;

      return {
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        slug: website.slug,
        organizationName: `${doctor.doctorName}'s Clinic`,
        logo: doctor.doctorPhoto, // Doctor's own logo/photo
        galleryPhotos: [],
        address: {
          city: "Medical District",
          state: "Gujarat",
          pincode: "380001",
          country: "India",
        },
        selectedTheme: "theme-teal-modern",
        browserTabTitle: `Dr. ${doctor.doctorName} — Medical Practice`,
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: false,
      };
    }

    return null;
  }
}
