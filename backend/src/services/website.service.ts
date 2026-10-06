import { Website, IWebsite, Doctor, Organization } from "@/models";
import { WebsiteType, EffectiveWebsiteData, DoctorDirectoryItem, FaqItem } from "@/types";
import { logAuditEvent } from "./audit.service";
import { AuthUserPayload } from "@/types";

function getDefaultDoctorFaqs(doctorName: string, specialization: string): FaqItem[] {
  return [
    {
      question: `How do I book a consultation with Dr. ${doctorName}?`,
      answer: `You can easily schedule a consultation by clicking the "Book Appointment" or "Consult via WhatsApp" button on this website, or by visiting the clinic during active consultation hours.`,
    },
    {
      question: `What documents or medical records should I bring?`,
      answer: `Please bring your past medical history, previous prescriptions, relevant diagnostic or laboratory reports, and a list of any current medications you are taking.`,
    },
    {
      question: `Are emergency consultations available outside scheduled hours?`,
      answer: `Consultations are offered during scheduled hours. In case of acute medical emergencies, please visit the nearest hospital emergency department immediately.`,
    },
    {
      question: `What conditions does Dr. ${doctorName} specialize in?`,
      answer: `Dr. ${doctorName} provides expert diagnosis and personalized clinical treatment for conditions within ${specialization}, following modern evidence-based medical guidelines.`,
    },
  ];
}

function getDefaultHospitalFaqs(hospitalName: string): FaqItem[] {
  return [
    {
      question: `What are the patient visiting and admission guidelines at ${hospitalName}?`,
      answer: `${hospitalName} accommodates patient visitors during designated visiting hours while adhering to strict clinical hygiene protocols to safeguard inpatient recovery.`,
    },
    {
      question: `Does ${hospitalName} provide emergency medical services?`,
      answer: `Yes, our emergency and critical care department is equipped to manage urgent medical situations with on-call specialists and advanced diagnostic support.`,
    },
    {
      question: `How can I consult specific specialists or departments?`,
      answer: `You can browse our doctor directory, select the appropriate department or specialist, and book an in-person or direct consultation.`,
    },
    {
      question: `What insurance policies or payment methods are accepted?`,
      answer: `We support multiple digital payment channels, major healthcare cards, and facilitate insurance documentation for cashless and reimbursement claims.`,
    },
  ];
}

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
   * Resolves public website data dynamically for single slug routes (/:slug).
   * Supports Independent Doctors and Hospital/Clinic organizations.
   * If a hospital doctor slug is requested directly, it resolves inheritance seamlessly.
   */
  static async resolveEffectiveWebsiteData(
    slug: string
  ): Promise<EffectiveWebsiteData | null> {
    const website = await Website.findOne({ slug: slug.toLowerCase() });
    if (!website) return null;

    // Do not expose draft websites publicly
    if (website.publishStatus !== "PUBLISHED") {
      return null;
    }

    // Type B: Hospital / Clinic Organization
    if (website.websiteType === WebsiteType.HOSPITAL_CLINIC) {
      const org = await Organization.findById(website.organizationId || website.ownerId);
      if (!org || org.status !== "ACTIVE") return null;

      // Fetch active affiliated doctors for directory
      const affiliatedDocs = await Doctor.find({
        organizationId: org._id,
        status: "ACTIVE",
      }).select("doctorName degree specialization yearsOfExperience slug doctorPhoto");

      const doctorDirectory: DoctorDirectoryItem[] = affiliatedDocs.map((doc) => ({
        id: doc._id.toString(),
        doctorName: doc.doctorName,
        degree: doc.degree,
        specialization: doc.specialization,
        yearsOfExperience: doc.yearsOfExperience,
        slug: doc.slug,
        doctorPhoto: doc.doctorPhoto,
      }));

      // Extract unique departments from doctors
      const departments = Array.from(
        new Set(affiliatedDocs.map((d) => d.specialization).filter(Boolean))
      );

      return {
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        slug: website.slug,
        organizationName: org.name,
        organizationType: org.type,
        about: org.about,
        phone: org.phone,
        whatsApp: org.whatsApp,
        email: org.email,
        workingHours: org.workingHours,
        weeklyOff: org.weeklyOff,
        appointmentRequired: org.appointmentRequired,
        logo: org.logo,
        galleryPhotos: org.galleryPhotos || [],
        address: org.address,
        selectedTheme: org.selectedTheme,
        faviconUrl: org.faviconUrl,
        browserTabTitle: org.browserTabTitle || `${org.name} — Healthcare & Clinics`,
        isHospitalChild: false,
        doctorDirectory,
        departments,
        faqs: getDefaultHospitalFaqs(org.name),
        seoMetadata: {
          title: org.browserTabTitle || `${org.name} — Premier Healthcare`,
          description: org.about || `${org.name} provides comprehensive healthcare services.`,
          ogImage: org.logo?.url,
        },
      };
    }

    // Type C (when requested via single slug): Hospital Doctor
    if (website.websiteType === WebsiteType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor || doctor.status !== "ACTIVE" || !doctor.organizationId) return null;

      const parentOrg = await Organization.findById(doctor.organizationId);
      if (!parentOrg || parentOrg.status !== "ACTIVE") return null;

      return {
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        slug: website.slug,
        // Runtime inherited from parent Hospital (strictly dynamic, zero duplication):
        organizationName: parentOrg.name,
        organizationType: parentOrg.type,
        logo: parentOrg.logo,
        galleryPhotos: parentOrg.galleryPhotos || [],
        address: parentOrg.address,
        selectedTheme: parentOrg.selectedTheme, // Inherited theme!
        faviconUrl: parentOrg.faviconUrl, // Inherited favicon!
        browserTabTitle: parentOrg.browserTabTitle || `${parentOrg.name} — Healthcare`,
        phone: parentOrg.phone,
        // Doctor specific attributes:
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        bio:
          doctor.bio ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        appointmentRequired: doctor.appointmentRequired,
        whatsApp: doctor.whatsApp || parentOrg.whatsApp,
        email: doctor.email,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: true,
        hospitalSlug: parentOrg.slug,
        faqs: getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
        seoMetadata: {
          title: `Dr. ${doctor.doctorName} — ${doctor.specialization} | ${parentOrg.name}`,
          description: `Consult Dr. ${doctor.doctorName} (${doctor.degree}), specialist in ${doctor.specialization} at ${parentOrg.name}, ${parentOrg.address.city}.`,
          ogImage: doctor.doctorPhoto?.url || parentOrg.logo?.url,
        },
      };
    }

    // Type A: Independent Doctor
    if (website.websiteType === WebsiteType.INDEPENDENT_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor || doctor.status !== "ACTIVE") return null;

      const clinicName = doctor.clinicName || `${doctor.doctorName}'s Medical Practice`;
      const fallbackAddress = doctor.address || {
        city: "Medical Center",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      return {
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        slug: website.slug,
        organizationName: clinicName,
        logo: doctor.clinicLogo || doctor.doctorPhoto,
        galleryPhotos: doctor.clinicPhotos || [],
        address: fallbackAddress,
        selectedTheme: website.templateId || "clinical-editorial",
        faviconUrl: website.seoMetadata?.ogImage || doctor.doctorPhoto?.url,
        browserTabTitle:
          website.seoMetadata?.title || `Dr. ${doctor.doctorName} — ${doctor.specialization}`,
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        bio:
          doctor.bio ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a dedicated ${doctor.specialization} specialist with over ${doctor.yearsOfExperience} years of medical experience.`,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        appointmentRequired: doctor.appointmentRequired,
        whatsApp: doctor.whatsApp,
        email: doctor.email,
        phone: doctor.whatsApp,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: false,
        faqs: getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
        seoMetadata: {
          title: website.seoMetadata?.title || `Dr. ${doctor.doctorName} — ${doctor.specialization}`,
          description:
            website.seoMetadata?.description ||
            `Consult Dr. ${doctor.doctorName} (${doctor.degree}) for ${doctor.specialization} at ${clinicName}.`,
          ogImage: doctor.doctorPhoto?.url,
        },
      };
    }

    return null;
  }

  /**
   * Resolves effective website data for a child hospital doctor accessed via /:organizationSlug/:doctorSlug.
   * Strict authorization using internal IDs:
   * 1. Resolves parent Organization by slug and ensures ACTIVE status.
   * 2. Resolves Doctor using doctorSlug AND organizationId: parentOrg._id (internal ID match).
   * 3. Resolves Website where doctorId === doctor._id and organizationId === parentOrg._id.
   * 4. Resolves parent Organization's current branding, address, theme, and favicon at runtime.
   */
  static async resolveEffectiveHospitalDoctorData(
    orgSlug: string,
    doctorSlug: string
  ): Promise<EffectiveWebsiteData | null> {
    // 1. Resolve parent Organization by slug
    const parentOrg = await Organization.findOne({
      slug: orgSlug.toLowerCase(),
      status: "ACTIVE",
    });
    if (!parentOrg) return null;

    // 2. Resolve Doctor by slug AND enforce internal parent organization ID match
    const doctor = await Doctor.findOne({
      slug: doctorSlug.toLowerCase(),
      organizationId: parentOrg._id,
      status: "ACTIVE",
    });
    if (!doctor) return null;

    // 3. Resolve Website record and enforce PUBLISHED status
    const website = await Website.findOne({
      doctorId: doctor._id,
      organizationId: parentOrg._id,
      publishStatus: "PUBLISHED",
    });
    if (!website) return null;

    // 4. Return dynamically resolved effective website data
    return {
      websiteType: WebsiteType.HOSPITAL_DOCTOR,
      slug: `${parentOrg.slug}/${doctor.slug}`,
      // Runtime inherited from parent Hospital (strictly dynamic, zero duplication):
      organizationName: parentOrg.name,
      organizationType: parentOrg.type,
      logo: parentOrg.logo,
      galleryPhotos: parentOrg.galleryPhotos || [],
      address: parentOrg.address,
      selectedTheme: parentOrg.selectedTheme, // Inherited theme!
      faviconUrl: parentOrg.faviconUrl, // Inherited favicon!
      browserTabTitle: parentOrg.browserTabTitle || `${parentOrg.name} — Healthcare`,
      phone: parentOrg.phone,
      // Doctor-owned professional attributes:
      doctorName: doctor.doctorName,
      gender: doctor.gender,
      degree: doctor.degree,
      specialization: doctor.specialization,
      yearsOfExperience: doctor.yearsOfExperience,
      bio:
        doctor.bio ||
        `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
      consultationHours: doctor.consultationHours,
      weeklyOff: doctor.weeklyOff,
      appointmentRequired: doctor.appointmentRequired,
      whatsApp: doctor.whatsApp || parentOrg.whatsApp,
      email: doctor.email,
      doctorPhoto: doctor.doctorPhoto,
      isHospitalChild: true,
      hospitalSlug: parentOrg.slug,
      faqs: getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
      seoMetadata: {
        title: `Dr. ${doctor.doctorName} — ${doctor.specialization} | ${parentOrg.name}`,
        description: `Consult Dr. ${doctor.doctorName} (${doctor.degree}), specialist in ${doctor.specialization} at ${parentOrg.name}, ${parentOrg.address.city}.`,
        ogImage: doctor.doctorPhoto?.url || parentOrg.logo?.url,
      },
    };
  }
}
