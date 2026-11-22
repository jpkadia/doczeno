import mongoose, { FilterQuery } from "mongoose";
import {
  ChatbotKnowledge,
  IChatbotKnowledge,
  Doctor,
  Organization,
  Website,
} from "@/models";

export interface TenantRetrievalScope {
  websiteType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR" | "HOSPITAL_CLINIC";
  organizationId?: string | mongoose.Types.ObjectId | null;
  doctorId?: string | mongoose.Types.ObjectId | null;
  websiteId?: string | mongoose.Types.ObjectId | null;
}

export function formatConsultationHours(raw: string | undefined): string {
  if (!raw) return "Monday - Saturday: 09:00 AM - 05:00 PM";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => {
          if (item.isClosed) {
            return `${item.day}: Closed`;
          }
          const slots = item.slots?.map((s: any) => `${s.startTime} to ${s.endTime}`).join(", ") || "Open";
          return `${item.day}: ${slots}`;
        })
        .join(" | ");
    }
  } catch {
    // Already formatted text
  }
  return raw;
}

export class RAGKnowledgeService {
  /**
   * Constructs strict MongoDB pre-filter ensuring zero cross-tenant leakage
   */
  public getTenantFilter(scope: TenantRetrievalScope): FilterQuery<IChatbotKnowledge> {
    const { websiteType, organizationId, doctorId } = scope;

    if (websiteType === "ONLY_DOCTOR") {
      if (!doctorId) {
        // Safe empty condition if doctorId missing
        return { doctorId: new mongoose.Types.ObjectId(), isActive: true, visibility: "PUBLIC" };
      }
      return {
        doctorId: new mongoose.Types.ObjectId(String(doctorId)),
        isActive: true,
        visibility: "PUBLIC",
      };
    }

    if (websiteType === "HOSPITAL" || websiteType === "HOSPITAL_CLINIC") {
      if (!organizationId) {
        return { organizationId: new mongoose.Types.ObjectId(), isActive: true, visibility: "PUBLIC" };
      }
      return {
        organizationId: new mongoose.Types.ObjectId(String(organizationId)),
        isActive: true,
        visibility: "PUBLIC",
      };
    }

    if (websiteType === "HOSPITAL_DOCTOR") {
      const orClauses: Array<FilterQuery<IChatbotKnowledge>> = [];

      if (doctorId) {
        orClauses.push({
          doctorId: new mongoose.Types.ObjectId(String(doctorId)),
        });
      }

      if (organizationId) {
        // Parent hospital knowledge chunks
        orClauses.push({
          organizationId: new mongoose.Types.ObjectId(String(organizationId)),
        });
      }

      if (orClauses.length === 0) {
        return { _id: new mongoose.Types.ObjectId() };
      }

      return {
        $or: orClauses,
        isActive: true,
        visibility: "PUBLIC",
      };
    }

    // Default safety fallback
    return { _id: new mongoose.Types.ObjectId() };
  }

  /**
   * Retrieves authorized knowledge chunks matching visitor query within the pre-filtered scope
   */
  public async retrieveAuthorizedKnowledge(
    scope: TenantRetrievalScope,
    queryText: string,
    limit = 6
  ): Promise<IChatbotKnowledge[]> {
    const preFilter = this.getTenantFilter(scope);

    // If query has specific words, extract tokens for relevance scoring
    const tokens = queryText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    let chunks: IChatbotKnowledge[] = [];

    if (tokens.length > 0) {
      // Regex pattern matching any of the significant keywords
      const regexPatterns = tokens.map((t) => new RegExp(t, "i"));
      const searchFilter: FilterQuery<IChatbotKnowledge> = {
        $and: [
          preFilter,
          {
            $or: [
              { title: { $in: regexPatterns } },
              { chunkText: { $in: regexPatterns } },
              { category: { $in: regexPatterns } },
            ],
          },
        ],
      };

      const query = ChatbotKnowledge.find(searchFilter);
      chunks = typeof (query as any)?.limit === "function" ? await (query as any).limit(limit) : await query;
    }

    // If no direct keyword hits or general greeting, retrieve top primary chunks
    if (chunks.length === 0) {
      const query = ChatbotKnowledge.find(preFilter);
      if (typeof (query as any)?.sort === "function") {
        chunks = await (query as any).sort({ updatedAt: -1 }).limit(limit);
      } else {
        chunks = await query;
      }
    }

    return chunks;
  }

  /**
   * Ingests and synchronizes knowledge chunks for Only Doctor
   */
  public async syncOnlyDoctorKnowledge(
    doctorId: string | mongoose.Types.ObjectId,
    websiteId?: string | mongoose.Types.ObjectId | null
  ): Promise<number> {
    const docObjectId = new mongoose.Types.ObjectId(String(doctorId));
    const doctor = await Doctor.findById(docObjectId);
    if (!doctor) return 0;

    const webObjectId = websiteId
      ? new mongoose.Types.ObjectId(String(websiteId))
      : doctor.websiteId
      ? new mongoose.Types.ObjectId(String(doctor.websiteId))
      : null;

    // Remove existing chunks for this doctor
    await ChatbotKnowledge.deleteMany({ doctorId: docObjectId });

    const chunksToInsert: Array<Partial<IChatbotKnowledge>> = [];

    // 1. Doctor Profile & Credentials
    chunksToInsert.push({
      doctorId: docObjectId,
      websiteId: webObjectId,
      sourceType: "DOCTOR_PROFILE",
      visibility: "PUBLIC",
      title: `Dr. ${doctor.doctorName} — Professional Profile & Credentials`,
      category: "Profile",
      chunkText: [
        `Doctor Name: Dr. ${doctor.doctorName}`,
        `Gender: ${doctor.gender}`,
        `Degree & Qualifications: ${doctor.degree}`,
        `Medical Specialization: ${doctor.specialization}`,
        `Clinical Experience: ${doctor.yearsOfExperience} years`,
        doctor.bio ? `Clinical Overview / Bio: ${doctor.bio}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      version: 1,
      isActive: true,
    });

    // 2. Clinic Information & Location
    if (doctor.clinicName || doctor.address) {
      chunksToInsert.push({
        doctorId: docObjectId,
        websiteId: webObjectId,
        sourceType: "PAGE_CONTENT",
        visibility: "PUBLIC",
        title: `${doctor.clinicName || "Clinic"} — Location & Contact`,
        category: "Location",
        chunkText: [
          `Clinic Name: ${doctor.clinicName || "Doctor Clinic"}`,
          doctor.address?.street ? `Street: ${doctor.address.street}` : "",
          `City: ${doctor.address?.city || "Local City"}`,
          `State: ${doctor.address?.state || ""}`,
          `Pincode: ${doctor.address?.pincode || ""}`,
          `Email: ${doctor.email}`,
          doctor.whatsApp ? `WhatsApp Booking: ${doctor.whatsApp}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        version: 1,
        isActive: true,
      });
    }

    // 3. Consultation Hours & Appointment Booking
    const formattedHours = formatConsultationHours(doctor.consultationHours);
    chunksToInsert.push({
      doctorId: docObjectId,
      websiteId: webObjectId,
      sourceType: "PAGE_CONTENT",
      visibility: "PUBLIC",
      title: "Consultation Hours & Appointment Policy",
      category: "Appointments",
      chunkText: [
        `Consultation Hours: ${formattedHours}`,
        `Weekly Off Days: ${doctor.weeklyOff || "Sunday"}`,
        `Appointment Required: ${doctor.appointmentRequired ? "Yes, prior appointment is required before visiting." : "Walk-ins accepted, appointment recommended."}`,
      ].join("\n"),
      version: 1,
      isActive: true,
    });

    // 4. Clinical Scope & Specialization Guidance
    const isCardio = doctor.specialization?.toLowerCase().includes("cardio");
    chunksToInsert.push({
      doctorId: docObjectId,
      websiteId: webObjectId,
      sourceType: "SERVICE",
      visibility: "PUBLIC",
      title: `${doctor.specialization || "Clinical"} Care & Specialization Scope`,
      category: "Services",
      chunkText: [
        `Medical Specialization: ${doctor.specialization}`,
        isCardio
          ? `Services Offered: Cardiology consultation, heart health assessment, ECG interpretation, hypertension (blood pressure) management, chest pain & discomfort evaluation, cardiovascular disease prevention and management.`
          : `Services Offered: Clinical consultations and healthcare treatments for ${doctor.specialization}.`,
        isCardio
          ? `Scope of Practice: Dr. ${doctor.doctorName} is a Cardiologist (Heart specialist / Hriday Rog). He treats heart conditions, chest discomfort, palpitations, and high BP. He does NOT treat unrelated general ailments like seasonal fever (bukhar), viral flu, cough/cold, stomach infections, dermatology, or dental issues. Patients with general fever or unrelated symptoms should consult a General Physician (MD Medicine).`
          : `Scope of Practice: Dr. ${doctor.doctorName} specializes specifically in ${doctor.specialization}. For other medical conditions, patients should consult the respective specialists.`,
      ].join("\n"),
      version: 1,
      isActive: true,
    });

    // 5. Approved Services and FAQs from Website if present
    if (webObjectId) {
      const website = await Website.findById(webObjectId);
      if (website?.seoMetadata?.description) {
        chunksToInsert.push({
          doctorId: docObjectId,
          websiteId: webObjectId,
          sourceType: "PAGE_CONTENT",
          visibility: "PUBLIC",
          title: "Clinical Focus & SEO Summary",
          category: "Overview",
          chunkText: website.seoMetadata.description,
          version: 1,
          isActive: true,
        });
      }
    }

    if (chunksToInsert.length > 0) {
      await ChatbotKnowledge.insertMany(chunksToInsert);
    }

    return chunksToInsert.length;
  }

  /**
   * Ingests and synchronizes knowledge chunks for a Hospital / Clinic
   */
  public async syncHospitalKnowledge(
    organizationId: string | mongoose.Types.ObjectId,
    websiteId?: string | mongoose.Types.ObjectId | null
  ): Promise<number> {
    const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
    const org = await Organization.findById(orgObjectId);
    if (!org) return 0;

    const webObjectId = websiteId
      ? new mongoose.Types.ObjectId(String(websiteId))
      : null;

    // Remove existing chunks for this organization
    await ChatbotKnowledge.deleteMany({ organizationId: orgObjectId });

    const chunksToInsert: Array<Partial<IChatbotKnowledge>> = [];

    // 1. Hospital Overview
    chunksToInsert.push({
      organizationId: orgObjectId,
      doctorId: null,
      websiteId: webObjectId,
      sourceType: "HOSPITAL_PROFILE",
      visibility: "PUBLIC",
      title: `${org.name} — Hospital Overview & Facilities`,
      category: "Overview",
      chunkText: [
        `Hospital Name: ${org.name}`,
        `Institution Type: ${org.type}`,
        org.about ? `About: ${org.about}` : "",
        `Working Hours: ${org.workingHours || "24/7 Emergency & Inpatient Services"}`,
        `Weekly Off: ${org.weeklyOff || "Open all days"}`,
        `Appointment Required: ${org.appointmentRequired ? "Yes for OPD consultations" : "Walk-in OPD and 24/7 Emergency"}`,
      ]
        .filter(Boolean)
        .join("\n"),
      version: 1,
      isActive: true,
    });

    // 2. Hospital Contact & Address
    chunksToInsert.push({
      organizationId: orgObjectId,
      doctorId: null,
      websiteId: webObjectId,
      sourceType: "PAGE_CONTENT",
      visibility: "PUBLIC",
      title: `${org.name} — Location, Contact & Emergency`,
      category: "Location",
      chunkText: [
        `Phone: ${org.phone}`,
        org.whatsApp ? `WhatsApp: ${org.whatsApp}` : "",
        `Email: ${org.email}`,
        `Address: ${org.address.street || ""}, ${org.address.city}, ${org.address.state} - ${org.address.pincode}`,
      ]
        .filter(Boolean)
        .join("\n"),
      version: 1,
      isActive: true,
    });

    // 3. Affiliated Active Doctors Directory
    const activeDoctors = await Doctor.find({
      organizationId: orgObjectId,
      status: "ACTIVE",
    }).lean();

    if (activeDoctors.length > 0) {
      const doctorLines = activeDoctors.map(
        (d) =>
          `- Dr. ${d.doctorName} (${d.specialization}, ${d.degree}, ${d.yearsOfExperience} yrs exp)`
      );
      chunksToInsert.push({
        organizationId: orgObjectId,
        doctorId: null,
        websiteId: webObjectId,
        sourceType: "PAGE_CONTENT",
        visibility: "PUBLIC",
        title: `${org.name} — Medical Specialists & Doctors Directory`,
        category: "Doctors",
        chunkText: [
          `Specialists currently practicing at ${org.name}:`,
          ...doctorLines,
        ].join("\n"),
        version: 1,
        isActive: true,
      });

      // Also index individual doctor chunks scoped under both org and doctor
      for (const doc of activeDoctors) {
        chunksToInsert.push({
          organizationId: orgObjectId,
          doctorId: doc._id as mongoose.Types.ObjectId,
          websiteId: webObjectId,
          sourceType: "DOCTOR_PROFILE",
          visibility: "PUBLIC",
          title: `Dr. ${doc.doctorName} (${doc.specialization}) at ${org.name}`,
          category: "Doctor Profile",
          chunkText: [
            `Doctor Name: Dr. ${doc.doctorName}`,
            `Hospital: ${org.name}`,
            `Specialization: ${doc.specialization}`,
            `Degree: ${doc.degree}`,
            `Experience: ${doc.yearsOfExperience} years`,
            doc.consultationHours ? `Hours: ${doc.consultationHours}` : "",
            doc.bio ? `Clinical Bio: ${doc.bio}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          version: 1,
          isActive: true,
        });
      }
    }

    if (chunksToInsert.length > 0) {
      await ChatbotKnowledge.insertMany(chunksToInsert);
    }

    return chunksToInsert.length;
  }
}

export const ragKnowledgeService = new RAGKnowledgeService();
