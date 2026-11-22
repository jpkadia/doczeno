import mongoose from "mongoose";
import {
  AIContent,
  IAIContent,
  Doctor,
  Organization,
  Website,
  AuditLog,
} from "@/models";
import { geminiService } from "./gemini.service";
import {
  AiTargetType,
  AiContentStatus,
  validateFullContent,
} from "@/validations/ai";
import { AuthUserPayload } from "@/types";

function toSafeObjectId(id?: string | null): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export class AIContentService {
  /**
   * Safely resolves a targetId that might be an ObjectId or a URL slug
   */
  private async resolveObjectId(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId
  ): Promise<mongoose.Types.ObjectId> {
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      return new mongoose.Types.ObjectId(targetId);
    }
    const cleanId = String(targetId).trim().toLowerCase();
    if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findOne({ slug: cleanId });
      if (org) return org._id as mongoose.Types.ObjectId;
      throw new Error(`Organization not found with slug: ${targetId}`);
    } else {
      const doc = await Doctor.findOne({ slug: cleanId });
      if (doc) return doc._id as mongoose.Types.ObjectId;
      throw new Error(`Doctor not found with slug: ${targetId}`);
    }
  }

  /**
   * Retrieves or creates an AI content record for a target entity
   */
  public async getOrCreateRecord(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId
  ): Promise<IAIContent> {
    const objectId = await this.resolveObjectId(targetType, targetId);
    let record = await AIContent.findOne({ targetType, targetId: objectId });

    if (!record) {
      // Find associated organizationId / doctorId for relational indexing
      let organizationId: mongoose.Types.ObjectId | null = null;
      let doctorId: mongoose.Types.ObjectId | null = null;

      if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
        doctorId = objectId;
      } else if (targetType === AiTargetType.HOSPITAL) {
        organizationId = objectId;
      } else if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
        doctorId = objectId;
        const doc = await Doctor.findById(objectId);
        if (doc && doc.organizationId) {
          organizationId = new mongoose.Types.ObjectId(String(doc.organizationId));
        }
      }

      const defaultContent = await this.buildDefaultContent(targetType, objectId);

      record = await AIContent.create({
        targetType,
        targetId: objectId,
        organizationId,
        doctorId,
        status: AiContentStatus.PUBLISHED,
        version: 1,
        draftContent: defaultContent,
        approvedContent: defaultContent,
        publishedContent: defaultContent,
        history: [
          {
            version: 1,
            status: AiContentStatus.PUBLISHED,
            content: defaultContent,
            action: "MANUAL_EDIT",
            createdAt: new Date(),
          },
        ],
      });
    } else if (!record.publishedContent && !record.draftContent) {
      const defaultContent = await this.buildDefaultContent(targetType, objectId);
      record.publishedContent = defaultContent;
      record.draftContent = defaultContent;
      record.approvedContent = defaultContent;
      record.status = AiContentStatus.PUBLISHED;
      await record.save();
    }

    return record;
  }

  /**
   * Extracts factual source data for an entity
   */
  private async gatherSourceData(targetType: string, targetId: string | mongoose.Types.ObjectId): Promise<{
    sourceData: Record<string, any>;
    doctorDoc?: any;
    orgDoc?: any;
  }> {
    const objectId = await this.resolveObjectId(targetType, targetId);

    if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
      const doctor = await Doctor.findById(objectId);
      if (!doctor) {
        throw new Error(`Doctor not found with id: ${targetId}`);
      }

      const sourceData = {
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        clinicName: doctor.clinicName || "Private Clinic",
        city: doctor.address?.city || "Local",
        state: doctor.address?.state || "",
        consultationHours: doctor.consultationHours || "By appointment",
        weeklyOff: doctor.weeklyOff || "Sunday",
      };

      return { sourceData, doctorDoc: doctor };
    }

    if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId);
      if (!org) {
        throw new Error(`Organization not found with id: ${targetId}`);
      }

      const sourceData = {
        hospitalName: org.name,
        type: org.type,
        city: org.address?.city || "",
        state: org.address?.state || "",
        workingHours: org.workingHours || "24/7 Emergency & Outpatient",
        weeklyOff: org.weeklyOff || "None",
      };

      return { sourceData, orgDoc: org };
    }

    if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(objectId);
      if (!doctor) {
        throw new Error(`Hospital doctor not found with id: ${targetId}`);
      }

      let org = null;
      if (doctor.organizationId) {
        org = await Organization.findById(doctor.organizationId);
      }

      const sourceData = {
        doctorName: doctor.doctorName,
        gender: doctor.gender,
        degree: doctor.degree,
        specialization: doctor.specialization,
        yearsOfExperience: doctor.yearsOfExperience,
        hospitalName: org?.name || "General Hospital",
        city: org?.address?.city || doctor.address?.city || "",
      };

      return { sourceData, doctorDoc: doctor, orgDoc: org };
    }

    throw new Error(`Invalid targetType: ${targetType}`);
  }

  /**
   * Generates a fresh AI draft content
   */
  public async generateDraft(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    user?: AuthUserPayload
  ): Promise<IAIContent> {
    const record = await this.getOrCreateRecord(targetType, targetId);

    if (record.status === AiContentStatus.GENERATING) {
      throw new Error("Content generation is currently in progress for this entity");
    }

    // Set status to GENERATING
    record.status = AiContentStatus.GENERATING;
    record.lastError = null;
    await record.save();

    try {
      const { sourceData, orgDoc } = await this.gatherSourceData(targetType, targetId);
      let generated: any;

      if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
        generated = await geminiService.generateOnlyDoctor(sourceData);
      } else if (targetType === AiTargetType.HOSPITAL) {
        generated = await geminiService.generateHospital(sourceData);
      } else if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
        generated = await geminiService.generateHospitalDoctor(sourceData, {
          name: orgDoc?.name || "Hospital",
          city: orgDoc?.address?.city || "",
        });
      }

      // Transition to DRAFT
      record.version += 1;
      record.draftContent = generated;
      record.status = AiContentStatus.DRAFT;
      record.lastError = null;

      record.history.push({
        version: record.version,
        status: AiContentStatus.DRAFT,
        content: generated,
        actorId: toSafeObjectId(user?.userId),
        actorRole: user?.role,
        action: "GENERATE",
        createdAt: new Date(),
      });

      await record.save();
      return record;
    } catch (err: any) {
      record.status = AiContentStatus.FAILED;
      record.lastError = err?.message || "Failed to generate AI content";
      await record.save();
      throw err;
    }
  }

  /**
   * Regenerates a single section without altering approved/published parts
   */
  public async regenerateSection(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    section: string,
    user?: AuthUserPayload
  ): Promise<IAIContent> {
    const record = await this.getOrCreateRecord(targetType, targetId);

    if (!record.draftContent) {
      throw new Error("Cannot regenerate section: No active draft exists. Please generate a full draft first.");
    }

    if (record.status === AiContentStatus.GENERATING) {
      throw new Error("Generation is currently in progress for this entity");
    }

    const previousStatus = record.status;
    record.status = AiContentStatus.GENERATING;
    await record.save();

    try {
      const { sourceData } = await this.gatherSourceData(targetType, targetId);
      const regeneratedValue = await geminiService.regenerateSection(
        targetType,
        section,
        sourceData,
        record.draftContent
      );

      // Mutate draftContent
      const updatedDraft = {
        ...record.draftContent,
        [section]: regeneratedValue,
      };

      record.draftContent = updatedDraft;
      record.version += 1;
      // Revert status to DRAFT so doctor/admin must review new section
      record.status = AiContentStatus.DRAFT;
      record.lastError = null;

      record.history.push({
        version: record.version,
        status: AiContentStatus.DRAFT,
        content: updatedDraft,
        sectionRegenerated: section,
        actorId: toSafeObjectId(user?.userId),
        actorRole: user?.role,
        action: "REGENERATE_SECTION",
        createdAt: new Date(),
      });

      await record.save();
      return record;
    } catch (err: any) {
      record.status = previousStatus;
      record.lastError = err?.message || `Failed to regenerate section "${section}"`;
      await record.save();
      throw err;
    }
  }

  /**
   * Approves draft content after human review (and optional manual edits)
   */
  public async approveDraft(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    editedContent?: Record<string, any>,
    user?: AuthUserPayload
  ): Promise<IAIContent> {
    const record = await this.getOrCreateRecord(targetType, targetId);

    if (!record.draftContent && !editedContent) {
      throw new Error("No draft content exists to approve");
    }

    const contentToApprove = editedContent || record.draftContent;

    // Validate full structure
    const validation = validateFullContent(targetType, contentToApprove);
    if (!validation.success) {
      throw new Error(`Content validation failed before approval: ${validation.error}`);
    }

    record.draftContent = validation.data;
    record.approvedContent = validation.data;
    record.status = AiContentStatus.APPROVED;
    record.reviewedBy = toSafeObjectId(user?.userId);
    record.version += 1;

    record.history.push({
      version: record.version,
      status: AiContentStatus.APPROVED,
      content: validation.data,
      actorId: toSafeObjectId(user?.userId),
      actorRole: user?.role,
      action: editedContent ? "MANUAL_EDIT" : "APPROVE",
      createdAt: new Date(),
    });

    await record.save();
    return record;
  }

  /**
   * Publishes approved content to the public live website and doctor/hospital models
   */
  public async publishContent(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    user?: AuthUserPayload
  ): Promise<IAIContent> {
    const record = await this.getOrCreateRecord(targetType, targetId);

    // CRITICAL ENFORCEMENT: Healthcare copy must never auto-publish without human approval
    if (record.status !== AiContentStatus.APPROVED || !record.approvedContent) {
      throw new Error(
        "Content cannot be published. A human administrator must review and approve the draft first."
      );
    }

    const approved = record.approvedContent;
    const objectId = await this.resolveObjectId(targetType, targetId);

    // Synchronize to domain models
    if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
      const doctor = await Doctor.findById(objectId);
      if (doctor) {
        doctor.bio = approved.about;
        await doctor.save();
      }

      // Update public Website record
      const website = await Website.findOne({
        $or: [{ doctorId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: approved.seoTitle,
          description: approved.seoDescription,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId);
      if (org) {
        org.about = approved.about;
        await org.save();
      }

      const website = await Website.findOne({
        $or: [{ organizationId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: approved.seoTitle,
          description: approved.seoDescription,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(objectId);
      if (doctor) {
        doctor.bio = approved.about;
        await doctor.save();
      }
    }

    record.publishedContent = approved;
    record.status = AiContentStatus.PUBLISHED;
    record.publishedBy = toSafeObjectId(user?.userId);
    record.version += 1;

    record.history.push({
      version: record.version,
      status: AiContentStatus.PUBLISHED,
      content: approved,
      actorId: toSafeObjectId(user?.userId),
      actorRole: user?.role,
      action: "PUBLISH",
      createdAt: new Date(),
    });

    await record.save();

    // Log to AuditLog
    await AuditLog.create({
      userId: toSafeObjectId(user?.userId),
      userRole: user?.role as any,
      action: "AI_CONTENT_PUBLISHED",
      entityType: targetType === AiTargetType.HOSPITAL ? "Organization" : "Doctor",
      entityId: String(targetId),
      details: {
        version: record.version,
        targetType,
        seoTitle: approved.seoTitle,
      },
      timestamp: new Date(),
    });

    return record;
  }

  /**
   * Generates initial sensible clinical copy from doctor or hospital profile
   */
  public async buildDefaultContent(
    targetType: string,
    objectId: mongoose.Types.ObjectId
  ): Promise<Record<string, any>> {
    try {
      const { sourceData, doctorDoc, orgDoc } = await this.gatherSourceData(targetType, objectId);
      const name = sourceData.doctorName ? `Dr. ${sourceData.doctorName}` : (sourceData.hospitalName || "Healthcare Clinic");
      const spec = sourceData.specialization || "General Medicine";
      const deg = sourceData.degree || "MBBS";
      const exp = sourceData.yearsOfExperience || 5;
      const city = sourceData.city || "Clinical Center";
      const clinicName = sourceData.clinicName || sourceData.hospitalName || "Clinical Center";

      const specLower = spec.toLowerCase();
      let defaultServices = [
        { title: "Fever & Infection Care", description: `Prompt clinical diagnosis and treatment for viral fevers, seasonal infections, and fatigue in ${city}.` },
        { title: "Diabetes & Blood Sugar", description: "Routine blood sugar monitoring, personalized diet guidance, and long-term medication management." },
        { title: "Blood Pressure & Heart", description: "Continuous monitoring and targeted medical therapy to keep blood pressure and heart health steady." },
        { title: "Digestive & Acidity Relief", description: "Effective medical relief and clinical management for gas, indigestion, stomach pain, and acid reflux." },
      ];

      if (specLower.includes("derma") || specLower.includes("skin")) {
        defaultServices = [
          { title: "Acne & Pimples", description: "Personalized clinical care for persistent acne, breakouts, scars, and sensitive facial skin." },
          { title: "Hair Fall & Dandruff", description: "Targeted diagnosis and medical therapies for scalp health, dandruff control, and hair thinning." },
          { title: "Skin Allergies & Rashes", description: "Immediate soothing relief and clinical care for chronic itching, hives, and allergic flare-ups." },
          { title: "Infections & Eczema", description: "Proven medical treatments for fungal infections, eczema, psoriasis, and daily skin protection." },
        ];
      } else if (specLower.includes("cardio") || specLower.includes("heart")) {
        defaultServices = [
          { title: "Chest Pain & Heart Health", description: "Thorough clinical evaluation of chest discomfort, blood pressure, and overall heart wellness." },
          { title: "High Blood Pressure (BP)", description: "Continuous monitoring and safe medical control of chronic hypertension." },
          { title: "Cholesterol Management", description: "Targeted lipid therapy and lifestyle planning to keep cholesterol levels in a safe range." },
          { title: "Heart Palpitations & Fatigue", description: "Targeted ECG screening and clinical assessment for irregular heartbeat and shortness of breath." },
        ];
      } else if (specLower.includes("ortho") || specLower.includes("bone") || specLower.includes("joint")) {
        defaultServices = [
          { title: "Knee & Joint Pain", description: "Focused non-surgical and clinical therapies to relieve joint stiffness and restore smooth mobility." },
          { title: "Back & Neck Pain", description: "Targeted medical assessment and postural care for chronic backache, sciatica, and neck strain." },
          { title: "Fractures & Sprains", description: "Prompt assessment, cast support, pain relief, and guided recovery for bone fractures and muscle sprains." },
          { title: "Arthritis & Bone Health", description: "Strengthening bone density and clinical management to prevent age-related bone weakness." },
        ];
      } else if (specLower.includes("pedia") || specLower.includes("child")) {
        defaultServices = [
          { title: "Child Fever & Cough", description: "Gentle, timely care for seasonal flu, viral coughs, cold, and common pediatric infections." },
          { title: "Vaccination & Growth", description: "Timely childhood immunizations following standard safety schedules and growth tracking." },
          { title: "Infant Digestion & Colic", description: "Practical medical guidance for baby feeding, infant colic, tummy discomfort, and digestion." },
          { title: "Child Allergies & Asthma", description: "Compassionate clinical treatment for pediatric respiratory allergies, asthma, and wheezing." },
        ];
      } else if (specLower.includes("gynec") || specLower.includes("gynaec") || specLower.includes("obs") || specLower.includes("women")) {
        defaultServices = [
          { title: "Pregnancy Care & Scans", description: "Routine health checkups, fetal monitoring, and nutritional guidance throughout pregnancy." },
          { title: "Irregular Periods & PCOD", description: "Hormonal evaluation, lifestyle counseling, and menstrual cycle regulation." },
          { title: "Pelvic Pain & Infections", description: "Confidential consultations, diagnostic care, and medical treatments for pelvic discomfort." },
          { title: "Women's Wellness & Menopause", description: "Preventive health screenings, bone health support, and wellness guidance for all ages." },
        ];
      }

      if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
        return {
          heroBadge: "Trusted Healthcare",
          tagline: `Dedicated ${spec} & Personalized Patient Care in ${city}`,
          about: doctorDoc?.bio || `${name} (${deg}) is an experienced specialist in ${spec} with over ${exp} years of dedicated clinical practice in ${city}. Committed to compassionate, evidence-based healthcare.`,
          shortIntro: `Specialist in ${spec} providing comprehensive diagnostic evaluations and tailored clinical treatments.`,
          clinicDescription: `${clinicName} provides a clean, well-equipped, and patient-first clinical environment in ${city}.`,
          services: defaultServices,
          faqs: [
            { question: "How can I book an appointment?", answer: "You can book an appointment online through this website or contact the clinic reception directly." },
            { question: "What should I bring for my first consultation?", answer: "Please bring your previous medical records, prescriptions, test reports, and any government ID." },
            { question: "Are emergency or walk-in consultations available?", answer: "Walk-in consultations are accommodated depending on availability, but booking in advance is strongly recommended." },
          ],
          seoTitle: `${name} — ${spec} Specialist in ${city}`,
          seoDescription: `Consult ${name} (${deg}), trusted ${spec} specialist in ${city}. View consultation timings, clinic services, and book appointments online.`,
        };
      }

      if (targetType === AiTargetType.HOSPITAL) {
        const hospitalName = orgDoc?.name || "Hospital & Healthcare Center";
        return {
          heroBadge: "Multi-Specialty Healthcare",
          tagline: `Advanced Medical Care & Compassionate Healing at ${hospitalName}`,
          about: orgDoc?.about || `${hospitalName} is a premier healthcare institution in ${city}, providing comprehensive clinical services with modern medical infrastructure and experienced specialists.`,
          hospitalIntro: `${hospitalName} delivers round-the-clock emergency care, advanced diagnostics, and multi-specialty clinical excellence.`,
          departments: [
            { name: "Outpatient Department (OPD)", description: "Daily consultations with senior medical specialists across multiple disciplines." },
            { name: "Emergency & Critical Care", description: "24/7 dedicated emergency unit equipped with life support and trauma stabilization facilities." },
            { name: "Diagnostic & Imaging", description: "Modern clinical laboratories, digital radiology, ultrasound, and pathology testing." },
          ],
          services: [
            { title: "In-Patient & Surgical Care", description: "State-of-the-art operative rooms, intensive care units, and comfortable post-operative patient wards." },
            { title: "Outpatient Specialist Consultations", description: "Consultations across cardiology, orthopedics, general surgery, pediatrics, and more." },
            { title: "24/7 Pharmacy & Emergency Response", description: "Round-the-clock emergency medical response and in-house pharmacy service." },
            { title: "Diagnostic & Laboratory Testing", description: "Fast, accurate diagnostic pathology, imaging, and routine health checkups." },
          ],
          faqs: [
            { question: "Is the emergency department open 24 hours?", answer: "Yes, our emergency and critical care departments operate 24 hours a day, 7 days a week." },
            { question: "How do I schedule an outpatient consultation?", answer: "You can book appointments through our website directory or by calling our hospital helpline." },
            { question: "Do you accept health insurance and cashless claims?", answer: "Yes, we partner with leading health insurance providers and TPAs for cashless hospital admission." },
          ],
          seoTitle: `${hospitalName} — Multi-Specialty Hospital in ${city}`,
          seoDescription: `${hospitalName} in ${city} provides 24/7 emergency care, multi-specialty outpatient consultations, advanced diagnostics, and surgical facilities.`,
        };
      }

      // HOSPITAL_DOCTOR
      const hospitalName = orgDoc?.name || "Hospital";
      return {
        heroBadge: "Specialist Consultant",
        tagline: `Specialist in ${spec} at ${hospitalName}`,
        professionalIntro: `Senior Consultant in ${spec} at ${hospitalName}, specializing in advanced clinical care and patient management.`,
        about: doctorDoc?.bio || `${name} (${deg}) serves as a senior specialist in ${spec} at ${hospitalName}, ${city}. With over ${exp} years of clinical expertise, ${name} is dedicated to exceptional clinical outcomes.`,
        expertiseSummary: `Extensive clinical expertise in acute and chronic patient care, specialized interventions, and multi-disciplinary case reviews in ${spec}.`,
        services: defaultServices,
        faqs: [
          { question: "Where is the doctor's OPD located in the hospital?", answer: `Dr. ${sourceData.doctorName}'s consultation room is located in the Outpatient Department (OPD) at ${hospitalName}.` },
          { question: "How can I book an appointment?", answer: "Appointments can be scheduled online via this website or at the hospital OPD registration counter." },
          { question: "Are diagnostic reports reviewed during follow-up?", answer: "Yes, all laboratory and imaging reports are thoroughly reviewed during follow-up visits." },
        ],
        seoTitle: `${name} — ${spec} at ${hospitalName}`,
        seoDescription: `Consult ${name} (${deg}), specialist in ${spec} at ${hospitalName}, ${city}. View OPD timings and book appointments.`,
      };
    } catch {
      return {
        tagline: "Quality Healthcare and Personalized Clinical Excellence",
        about: "Providing comprehensive, evidence-based healthcare with a patient-centered approach.",
        shortIntro: "Dedicated clinical practice focused on accurate diagnosis and compassionate care.",
        services: [
          { title: "Comprehensive Medical Consultation", description: "Full clinical assessment and diagnosis." },
        ],
        faqs: [
          { question: "How can I book an appointment?", answer: "Book online via this page or contact the clinic reception." },
        ],
        seoTitle: "Official Clinical Website",
        seoDescription: "Book appointments, view consultation timings, and discover healthcare services online.",
      };
    }
  }

  /**
   * Directly saves and updates manually edited live website content
   */
  public async updateLiveContent(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    content: Record<string, any>,
    user?: AuthUserPayload
  ): Promise<IAIContent> {
    const objectId = await this.resolveObjectId(targetType, targetId);
    let record = await this.getOrCreateRecord(targetType, targetId);

    record.draftContent = content;
    record.approvedContent = content;
    record.publishedContent = content;
    record.status = AiContentStatus.PUBLISHED;
    record.version += 1;
    record.reviewedBy = toSafeObjectId(user?.userId);
    record.publishedBy = toSafeObjectId(user?.userId);

    record.history.push({
      version: record.version,
      status: AiContentStatus.PUBLISHED,
      content,
      actorId: toSafeObjectId(user?.userId),
      actorRole: user?.role,
      action: "MANUAL_EDIT",
      createdAt: new Date(),
    });

    await record.save();

    // Synchronize to domain models
    if (targetType === AiTargetType.ONLY_DOCTOR || targetType === "INDEPENDENT_DOCTOR") {
      const doctor = await Doctor.findById(objectId);
      if (doctor) {
        if (content.about) doctor.bio = content.about;
        await doctor.save();
      }

      const website = await Website.findOne({
        $or: [{ doctorId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: content.seoTitle || website.seoMetadata?.title,
          description: content.seoDescription || website.seoMetadata?.description,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId);
      if (org) {
        if (content.about) org.about = content.about;
        await org.save();
      }

      const website = await Website.findOne({
        $or: [{ organizationId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: content.seoTitle || website.seoMetadata?.title,
          description: content.seoDescription || website.seoMetadata?.description,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(objectId);
      if (doctor) {
        if (content.about) doctor.bio = content.about;
        await doctor.save();
      }
    }

    return record;
  }
}

export const aiContentService = new AIContentService();
