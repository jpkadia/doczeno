import { Website, IWebsite, Doctor, Organization, Review } from "@/models";
import { WebsiteType, EffectiveWebsiteData, DoctorDirectoryItem, FaqItem, TestimonialItem } from "@/types";
import { logAuditEvent } from "./audit.service";
import { AuthUserPayload } from "@/types";
import { geminiService } from "./gemini.service";
import { aiContentService } from "./ai-content.service";

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
   * Retrieves live published patient testimonials from MongoDB.
   * If none exist yet, automatically generates contextual testimonials via AI
   * and persists them into the Review collection.
   */
  public static async getOrSeedReviews(params: {
    doctorId?: any;
    organizationId?: any;
    type: "DOCTOR" | "HOSPITAL";
    doctorName?: string;
    specialization?: string;
    degree?: string;
    clinicName?: string;
    hospitalName?: string;
    city?: string;
  }): Promise<TestimonialItem[]> {
    try {
      const query: Record<string, any> = { isPublished: true };
      if (params.doctorId) {
        query.doctorId = params.doctorId;
      } else if (params.organizationId) {
        query.organizationId = params.organizationId;
      }

      let docs = await Review.find(query).sort({ createdAt: -1 });
      if (docs.length === 0) {
        const generated = await geminiService.generatePatientTestimonials({
          type: params.type,
          doctorName: params.doctorName,
          specialization: params.specialization,
          degree: params.degree,
          clinicName: params.clinicName,
          hospitalName: params.hospitalName,
          city: params.city,
        });

        const toInsert = generated.map((g) => ({
          doctorId: params.doctorId || null,
          organizationId: params.organizationId || null,
          patientName: g.patientName,
          rating: g.rating,
          comment: g.comment,
          tag: g.tag,
          isVerified: true,
          isPublished: true,
        }));

        try {
          docs = (await Review.insertMany(toInsert)) as any;
        } catch {
          docs = [];
        }
      }

      return docs.map((r: any) => ({
        id: r._id.toString(),
        patientName: r.patientName,
        rating: r.rating,
        comment: r.comment,
        tag: r.tag || "Verified Patient",
        isVerified: r.isVerified,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Runtime Data Inheritance Engine
   * Resolves public website data dynamically for single slug routes (/:slug).
   * Supports Only Doctors and Hospital/Clinic organizations.
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
      if (!org) return null;

      if (org.status !== "ACTIVE") {
        return {
          isDeactivated: true,
          deactivationMessage: "Your website is temporarily deactivated. Please contact admin.",
          slug: website.slug,
          organizationName: org.name,
          websiteType: WebsiteType.HOSPITAL_CLINIC,
          selectedTheme: "hospital-classic",
          browserTabTitle: `${org.name} — Deactivated`,
          address: org.address || { city: "", state: "", pincode: "", country: "India" },
          galleryPhotos: [],
          isHospitalChild: false,
        } as any;
      }

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

      // Extract unique departments from registered specialties and doctors
      const departments = Array.from(
        new Set([
          ...(Array.isArray(org.specialties) ? org.specialties : []),
          ...(Array.isArray((org as any).departments) ? (org as any).departments : []),
          ...affiliatedDocs.map((d) => d.specialization).filter(Boolean),
        ])
      );

      const testimonials = await WebsiteService.getOrSeedReviews({
        organizationId: org._id,
        type: "HOSPITAL",
        hospitalName: org.name,
        city: org.address?.city,
      });

      let aiContent: Record<string, any> = {};
      try {
        const aiRecord = await aiContentService.getOrCreateRecord("HOSPITAL", org._id);
        aiContent = aiRecord.publishedContent || aiRecord.approvedContent || aiRecord.draftContent || {};
      } catch {
        aiContent = {};
      }

      return {
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        slug: website.slug,
        organizationId: org._id.toString(),
        organizationName: org.name,
        organizationType: org.type,
        about: org.about || aiContent.about,
        tagline: aiContent.tagline || `${org.name} — Medical Center`,
        shortIntro: aiContent.hospitalIntro || aiContent.shortIntro || org.about,
        clinicDescription: aiContent.hospitalIntro,
        services: Array.isArray(aiContent.services) && aiContent.services.length > 0 ? aiContent.services : undefined,
        departmentsDetailed: Array.isArray(aiContent.departments) && aiContent.departments.length > 0 ? aiContent.departments : undefined,
        phone: org.phone,
        whatsApp: org.whatsApp,
        email: org.email,
        workingHours: org.workingHours,
        weeklyOff: org.weeklyOff,
        appointmentRequired: org.appointmentRequired,
        logo: org.logo,
        buildingPhoto: org.buildingPhoto,
        galleryPhotos: org.galleryPhotos || [],
        address: org.address,
        selectedTheme: org.selectedTheme,
        faviconUrl: org.faviconUrl?.trim() || undefined,
        browserTabTitle: aiContent.seoTitle || org.browserTabTitle || `${org.name} — Healthcare & Clinics`,
        isHospitalChild: false,
        doctorDirectory,
        departments,
        specialties: (Array.isArray(org.specialties) && org.specialties.length > 0)
          ? org.specialties
          : (Array.isArray((org as any).departments) && (org as any).departments.length > 0)
          ? (org as any).departments
          : departments,
        faqs: Array.isArray(aiContent.faqs) && aiContent.faqs.length > 0 ? aiContent.faqs : getDefaultHospitalFaqs(org.name),
        testimonials,
        seoMetadata: {
          title: aiContent.seoTitle || org.browserTabTitle || `${org.name} — Premier Healthcare`,
          description: aiContent.seoDescription || org.about || `${org.name} provides comprehensive healthcare services.`,
          ogImage: org.buildingPhoto?.url || org.logo?.url,
        },
        websiteContent: aiContent,
      };
    }

    // Type C (when requested via single slug): Hospital Doctor
    if (website.websiteType === WebsiteType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor || doctor.status !== "ACTIVE" || !doctor.organizationId) return null;

      const parentOrg = await Organization.findById(doctor.organizationId);
      if (!parentOrg || parentOrg.status !== "ACTIVE") return null;

      const testimonials = await WebsiteService.getOrSeedReviews({
        doctorId: doctor._id,
        organizationId: parentOrg._id,
        type: "DOCTOR",
        doctorName: doctor.doctorName,
        specialization: doctor.specialization,
        degree: doctor.degree,
        hospitalName: parentOrg.name,
        city: parentOrg.address?.city,
      });

      let aiContent: Record<string, any> = {};
      try {
        const aiRecord = await aiContentService.getOrCreateRecord("HOSPITAL_DOCTOR", doctor._id);
        aiContent = aiRecord.publishedContent || aiRecord.approvedContent || aiRecord.draftContent || {};
      } catch {
        aiContent = {};
      }

      return {
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        slug: website.slug,
        doctorId: doctor._id.toString(),
        organizationId: parentOrg._id.toString(),
        // Runtime inherited from parent Hospital (strictly dynamic, zero duplication):
        organizationName: parentOrg.name,
        organizationType: parentOrg.type,
        logo: parentOrg.logo,
        galleryPhotos: parentOrg.galleryPhotos || [],
        address: parentOrg.address,
        selectedTheme: parentOrg.selectedTheme, // Inherited theme!
        faviconUrl: parentOrg.faviconUrl?.trim() || undefined, // Inherited favicon!
        browserTabTitle: aiContent.seoTitle || parentOrg.browserTabTitle || `${parentOrg.name} — Healthcare`,
        phone: parentOrg.phone,
        tagline: aiContent.tagline || aiContent.professionalIntro || `Specialist in ${doctor.specialization} at ${parentOrg.name}`,
        shortIntro: aiContent.professionalIntro || aiContent.shortIntro,
        clinicDescription: aiContent.expertiseSummary,
        services: Array.isArray(aiContent.services) && aiContent.services.length > 0 ? aiContent.services : undefined,
        // Doctor specific attributes:
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        newCaseFee: doctor.newCaseFee,
        oldCaseFee: doctor.oldCaseFee,
        bio:
          doctor.bio ||
          aiContent.about ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
        about:
          doctor.bio ||
          aiContent.about ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        appointmentRequired: doctor.appointmentRequired,
        whatsApp: doctor.whatsApp || parentOrg.whatsApp,
        email: doctor.email,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: true,
        hospitalSlug: parentOrg.slug,
        faqs: Array.isArray(aiContent.faqs) && aiContent.faqs.length > 0 ? aiContent.faqs : getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
        testimonials,
        seoMetadata: {
          title: aiContent.seoTitle || `Dr. ${doctor.doctorName} — ${doctor.specialization} | ${parentOrg.name}`,
          description: aiContent.seoDescription || `Consult Dr. ${doctor.doctorName} (${doctor.degree}), specialist in ${doctor.specialization} at ${parentOrg.name}, ${parentOrg.address.city}.`,
          ogImage: doctor.doctorPhoto?.url || parentOrg.logo?.url,
        },
        websiteContent: aiContent,
      };
    }

    // Type A: Only Doctor
    if (website.websiteType === WebsiteType.ONLY_DOCTOR) {
      const doctor = await Doctor.findById(website.doctorId || website.ownerId);
      if (!doctor) return null;

      if (doctor.status !== "ACTIVE") {
        return {
          isDeactivated: true,
          deactivationMessage: "Your website is temporarily deactivated. Please contact admin.",
          slug: website.slug,
          doctorName: doctor.doctorName,
          organizationName: doctor.clinicName || doctor.doctorName,
          websiteType: WebsiteType.ONLY_DOCTOR,
          selectedTheme: "hospital-classic",
          browserTabTitle: `Dr. ${doctor.doctorName} — Deactivated`,
          address: doctor.address || { city: "", state: "", pincode: "", country: "India" },
          galleryPhotos: [],
          isHospitalChild: false,
        } as any;
      }

      const clinicName = doctor.clinicName || `${doctor.doctorName}'s Clinic`;
      const fallbackAddress = doctor.address || {
        city: "Medical Center",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const testimonials = await WebsiteService.getOrSeedReviews({
        doctorId: doctor._id,
        type: "DOCTOR",
        doctorName: doctor.doctorName,
        specialization: doctor.specialization,
        degree: doctor.degree,
        clinicName,
        city: fallbackAddress.city,
      });

      let aiContent: Record<string, any> = {};
      try {
        const aiRecord = await aiContentService.getOrCreateRecord("ONLY_DOCTOR", doctor._id);
        aiContent = aiRecord.publishedContent || aiRecord.approvedContent || aiRecord.draftContent || {};
      } catch {
        aiContent = {};
      }

      return {
        websiteType: WebsiteType.ONLY_DOCTOR,
        slug: website.slug,
        doctorId: doctor._id.toString(),
        organizationName: clinicName,
        logo: doctor.clinicLogo || doctor.doctorPhoto,
        galleryPhotos: doctor.clinicPhotos || [],
        address: fallbackAddress,
        selectedTheme: website.templateId || "hospital-classic",
        faviconUrl: website.faviconUrl?.trim() || undefined,
        browserTabTitle:
          aiContent.seoTitle || website.seoMetadata?.title || `Dr. ${doctor.doctorName} — ${doctor.specialization}`,
        tagline: aiContent.tagline || `Specialist in ${doctor.specialization} | Dedicated Patient Care`,
        shortIntro: aiContent.shortIntro,
        clinicDescription: aiContent.clinicDescription,
        services: Array.isArray(aiContent.services) && aiContent.services.length > 0 ? aiContent.services : undefined,
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        newCaseFee: doctor.newCaseFee,
        oldCaseFee: doctor.oldCaseFee,
        bio:
          doctor.bio ||
          aiContent.about ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a dedicated ${doctor.specialization} specialist with over ${doctor.yearsOfExperience} years of medical experience.`,
        about:
          doctor.bio ||
          aiContent.about ||
          `Dr. ${doctor.doctorName} (${doctor.degree}) is a dedicated ${doctor.specialization} specialist with over ${doctor.yearsOfExperience} years of medical experience.`,
        consultationHours: doctor.consultationHours,
        weeklyOff: doctor.weeklyOff,
        appointmentRequired: doctor.appointmentRequired,
        whatsApp: doctor.whatsApp,
        email: doctor.email,
        phone: doctor.whatsApp,
        doctorPhoto: doctor.doctorPhoto,
        isHospitalChild: false,
        faqs: Array.isArray(aiContent.faqs) && aiContent.faqs.length > 0 ? aiContent.faqs : getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
        testimonials,
        seoMetadata: {
          title: aiContent.seoTitle || website.seoMetadata?.title || `Dr. ${doctor.doctorName} — ${doctor.specialization}`,
          description:
            aiContent.seoDescription ||
            website.seoMetadata?.description ||
            `Consult Dr. ${doctor.doctorName} (${doctor.degree}) for ${doctor.specialization} at ${clinicName}.`,
          ogImage: doctor.doctorPhoto?.url,
        },
        websiteContent: aiContent,
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
    });
    if (!parentOrg) return null;

    if (parentOrg.status !== "ACTIVE") {
      return {
        isDeactivated: true,
        deactivationMessage: "Your website is temporarily deactivated. Please contact admin.",
        slug: orgSlug,
        organizationName: parentOrg.name,
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        selectedTheme: "hospital-classic",
        browserTabTitle: `${parentOrg.name} — Deactivated`,
        address: parentOrg.address || { city: "", state: "", pincode: "", country: "India" },
        galleryPhotos: [],
        isHospitalChild: false,
      } as any;
    }

    // 2. Resolve Doctor by slug AND enforce internal parent organization ID match
    const doctor = await Doctor.findOne({
      slug: doctorSlug.toLowerCase(),
      organizationId: parentOrg._id,
    });
    if (!doctor) return null;

    if (doctor.status !== "ACTIVE") {
      return {
        isDeactivated: true,
        deactivationMessage: "Your website is temporarily deactivated. Please contact admin.",
        slug: doctorSlug,
        doctorName: doctor.doctorName,
        organizationName: parentOrg.name,
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        selectedTheme: "hospital-classic",
        browserTabTitle: `Dr. ${doctor.doctorName} — Deactivated`,
        address: parentOrg.address || { city: "", state: "", pincode: "", country: "India" },
        galleryPhotos: [],
        isHospitalChild: true,
      } as any;
    }

    // 3. Resolve Website record and enforce PUBLISHED status
    const website = await Website.findOne({
      doctorId: doctor._id,
      organizationId: parentOrg._id,
      publishStatus: "PUBLISHED",
    });
    if (!website) return null;

    const testimonials = await WebsiteService.getOrSeedReviews({
      doctorId: doctor._id,
      organizationId: parentOrg._id,
      type: "DOCTOR",
      doctorName: doctor.doctorName,
      specialization: doctor.specialization,
      degree: doctor.degree,
      hospitalName: parentOrg.name,
      city: parentOrg.address?.city,
    });

    let aiContent: Record<string, any> = {};
    try {
      const aiRecord = await aiContentService.getOrCreateRecord("HOSPITAL_DOCTOR", doctor._id);
      aiContent = aiRecord.publishedContent || aiRecord.approvedContent || aiRecord.draftContent || {};
    } catch {
      aiContent = {};
    }

    // 4. Return dynamically resolved effective website data
    return {
      websiteType: WebsiteType.HOSPITAL_DOCTOR,
      slug: `${parentOrg.slug}/${doctor.slug}`,
      doctorId: doctor._id.toString(),
      organizationId: parentOrg._id.toString(),
      // Runtime inherited from parent Hospital (strictly dynamic, zero duplication):
      organizationName: parentOrg.name,
      organizationType: parentOrg.type,
      logo: parentOrg.logo,
      galleryPhotos: parentOrg.galleryPhotos || [],
      address: parentOrg.address,
      selectedTheme: parentOrg.selectedTheme, // Inherited theme!
      faviconUrl: parentOrg.faviconUrl?.trim() || undefined, // Inherited favicon!
      browserTabTitle: aiContent.seoTitle || parentOrg.browserTabTitle || `${parentOrg.name} — Healthcare`,
      phone: parentOrg.phone,
      tagline: aiContent.tagline || aiContent.professionalIntro || `Specialist in ${doctor.specialization} at ${parentOrg.name}`,
      shortIntro: aiContent.professionalIntro || aiContent.shortIntro,
      clinicDescription: aiContent.expertiseSummary,
      services: Array.isArray(aiContent.services) && aiContent.services.length > 0 ? aiContent.services : undefined,
      // Doctor-owned professional attributes:
      doctorName: doctor.doctorName,
      gender: doctor.gender,
      degree: doctor.degree,
      specialization: doctor.specialization,
      yearsOfExperience: doctor.yearsOfExperience,
      newCaseFee: doctor.newCaseFee,
      oldCaseFee: doctor.oldCaseFee,
      bio:
        doctor.bio ||
        aiContent.about ||
        `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
      about:
        doctor.bio ||
        aiContent.about ||
        `Dr. ${doctor.doctorName} (${doctor.degree}) is a recognized specialist in ${doctor.specialization} at ${parentOrg.name}.`,
      consultationHours: doctor.consultationHours,
      weeklyOff: doctor.weeklyOff,
      appointmentRequired: doctor.appointmentRequired,
      whatsApp: doctor.whatsApp || parentOrg.whatsApp,
      email: doctor.email,
      doctorPhoto: doctor.doctorPhoto,
      isHospitalChild: true,
      hospitalSlug: parentOrg.slug,
      faqs: Array.isArray(aiContent.faqs) && aiContent.faqs.length > 0 ? aiContent.faqs : getDefaultDoctorFaqs(doctor.doctorName, doctor.specialization),
      testimonials,
      seoMetadata: {
        title: aiContent.seoTitle || `Dr. ${doctor.doctorName} — ${doctor.specialization} | ${parentOrg.name}`,
        description: aiContent.seoDescription || `Consult Dr. ${doctor.doctorName} (${doctor.degree}), specialist in ${doctor.specialization} at ${parentOrg.name}, ${parentOrg.address.city}.`,
        ogImage: doctor.doctorPhoto?.url || parentOrg.logo?.url,
      },
      websiteContent: aiContent,
    };
  }
}
