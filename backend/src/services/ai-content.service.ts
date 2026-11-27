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
  sanitizeAndValidateWebsiteLayoutConfig,
} from "@/validations/ai";
import { AuthUserPayload } from "@/types";

function toSafeObjectId(id?: string | null): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/**
 * Resolves a hospital's canonical selected specialty list (specialties prioritized, falling back to departments).
 */
export function resolveOrganizationSpecialties(org: {
  specialties?: string[];
  departments?: string[];
} | null | undefined): string[] {
  if (!org) return [];
  const specs = Array.isArray(org.specialties) ? org.specialties : [];
  const depts = Array.isArray((org as any).departments) ? (org as any).departments : [];
  const merged = specs.length > 0 ? specs : depts;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of merged) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Reconciles AI service cards to match a hospital's exact selected specialties 1-to-1,
 * preserving existing custom descriptions where specialty names match.
 */
export function reconcileHospitalServicesWithSpecialties(
  specialties: string[],
  existingServices: any[] = [],
  city?: string
): Array<{ title: string; description: string }> {
  const existingMap = new Map<string, string>();
  if (Array.isArray(existingServices)) {
    for (const item of existingServices) {
      const titleKey = String(item?.title || item?.name || "").trim().toLowerCase();
      const desc = String(item?.description || "").trim();
      if (titleKey && desc) {
        existingMap.set(titleKey, desc);
      }
    }
  }

  return specialties.map((spec) => ({
    title: spec,
    description:
      existingMap.get(spec.toLowerCase()) ||
      `Specialized clinical diagnosis, outpatient consultations, and medical care in ${spec}${city ? ` at our ${city} center` : ""}.`.slice(0, 120),
  }));
}

/**
 * Reconciles AI department cards to match a hospital's exact selected specialties 1-to-1.
 */
export function reconcileHospitalDepartmentsWithSpecialties(
  specialties: string[],
  existingDepartments: any[] = [],
  city?: string
): Array<{ name: string; description: string }> {
  const existingMap = new Map<string, string>();
  if (Array.isArray(existingDepartments)) {
    for (const item of existingDepartments) {
      const nameKey = String(item?.name || item?.title || "").trim().toLowerCase();
      const desc = String(item?.description || "").trim();
      if (nameKey && desc) {
        existingMap.set(nameKey, desc);
      }
    }
  }

  return specialties.map((spec) => ({
    name: spec,
    description:
      existingMap.get(spec.toLowerCase()) ||
      `Dedicated ${spec} department offering specialist consultations and comprehensive patient care${city ? ` in ${city}` : ""}.`,
  }));
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
    } else if (targetType === AiTargetType.HOSPITAL) {
      // Ensure hospital AI content services/departments always stay synced with selected specialties
      const org = await Organization.findById(objectId).select("specialties departments address").lean();
      const orgSpecs = resolveOrganizationSpecialties(org);
      if (orgSpecs.length > 0) {
        const city = org?.address?.city;
        let changed = false;
        const syncContentBlock = (block: any) => {
          if (!block || typeof block !== "object") return block;
          const curSvcs = Array.isArray(block.services) ? block.services : [];
          const sameServices =
            curSvcs.length === orgSpecs.length &&
            orgSpecs.every((s, idx) => String(curSvcs[idx]?.title || "").trim().toLowerCase() === s.toLowerCase());
          const curDepts = Array.isArray(block.departments) ? block.departments : [];
          const sameDepts =
            curDepts.length === orgSpecs.length &&
            orgSpecs.every((s, idx) => String(curDepts[idx]?.name || "").trim().toLowerCase() === s.toLowerCase());
          if (sameServices && sameDepts) return block;
          changed = true;
          return {
            ...block,
            services: reconcileHospitalServicesWithSpecialties(orgSpecs, curSvcs, city),
            departments: reconcileHospitalDepartmentsWithSpecialties(orgSpecs, curDepts, city),
          };
        };
        record.draftContent = syncContentBlock(record.draftContent);
        record.approvedContent = syncContentBlock(record.approvedContent);
        record.publishedContent = syncContentBlock(record.publishedContent);
        if (changed) {
          record.markModified("draftContent");
          record.markModified("approvedContent");
          record.markModified("publishedContent");
          await record.save();
        }
      }
    }

    return record;
  }

  public async getHospitalSpecialties(targetId: string | mongoose.Types.ObjectId): Promise<string[]> {
    const objectId = await this.resolveObjectId(AiTargetType.HOSPITAL, targetId);
    const org = await Organization.findById(objectId).select("specialties departments").lean();
    return resolveOrganizationSpecialties(org);
  }

  /**
   * Synchronizes Hospital AIContent services & departments when Specialties/Departments change in Hospital Admin.
   */
  public async syncHospitalSpecialtiesToContent(
    organizationId: string | mongoose.Types.ObjectId,
    specialties: string[],
    city?: string
  ): Promise<void> {
    const objectId = await this.resolveObjectId(AiTargetType.HOSPITAL, organizationId);
    const orgSpecs = resolveOrganizationSpecialties({ specialties });
    if (orgSpecs.length === 0) return;

    const record = await AIContent.findOne({ targetType: AiTargetType.HOSPITAL, targetId: objectId });
    if (!record) return;

    const updateBlock = (block: any) => {
      if (!block || typeof block !== "object") return block;
      return {
        ...block,
        services: reconcileHospitalServicesWithSpecialties(orgSpecs, block.services, city),
        departments: reconcileHospitalDepartmentsWithSpecialties(orgSpecs, block.departments, city),
      };
    };

    record.draftContent = updateBlock(record.draftContent);
    record.approvedContent = updateBlock(record.approvedContent);
    record.publishedContent = updateBlock(record.publishedContent);
    record.markModified("draftContent");
    record.markModified("approvedContent");
    record.markModified("publishedContent");
    await record.save();
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

      const specs = resolveOrganizationSpecialties(org);
      const sourceData = {
        hospitalName: org.name,
        type: org.type,
        city: org.address?.city || "",
        state: org.address?.state || "",
        workingHours: org.workingHours || "24/7 Emergency & Outpatient",
        weeklyOff: org.weeklyOff || "None",
        specialties: specs,
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
        const orgSpecs = resolveOrganizationSpecialties(orgDoc);
        if (orgSpecs.length > 0) {
          generated = {
            ...generated,
            services: reconcileHospitalServicesWithSpecialties(orgSpecs, generated.services, orgDoc?.address?.city),
            departments: reconcileHospitalDepartmentsWithSpecialties(orgSpecs, generated.departments, orgDoc?.address?.city),
          };
        }
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

  public async checkAiRegenerateEnabled(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const objectId = await this.resolveObjectId(targetType, targetId);
    if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId).select("isAiRegenerateEnabled").lean();
      return org?.isAiRegenerateEnabled === true;
    }

    const doc = await Doctor.findById(objectId)
      .select("isAiRegenerateEnabled organizationId")
      .lean();
    if (!doc || doc.isAiRegenerateEnabled !== true) {
      return false;
    }
    if (doc.organizationId) {
      const parentOrg = await Organization.findById(doc.organizationId)
        .select("isAiRegenerateEnabled")
        .lean();
      if (!parentOrg || parentOrg.isAiRegenerateEnabled !== true) {
        return false;
      }
    }
    return true;
  }

  public getRegenerationQuota(record: IAIContent): {
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
  } {
    const dailyLimit = 5;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (record.regenerationTimestamps || []).filter(
      (d) => new Date(d).getTime() > cutoff
    );
    return {
      dailyLimit,
      usedToday: recent.length,
      remainingToday: Math.max(0, dailyLimit - recent.length),
    };
  }

  private clampRegeneratedSection(
    targetType: string,
    section: string,
    value: any,
    hospitalSpecialties?: string[],
    city?: string
  ): any {
    const clampStr = (s: unknown, max: number) =>
      typeof s === "string" ? s.trim().slice(0, max) : "";

    if (section === "tagline") return clampStr(value, 150);
    if (section === "shortIntro") return clampStr(value, 350);
    if (section === "hospitalIntro" || section === "professionalIntro") return clampStr(value, 500);
    if (section === "about") return clampStr(value, 1500);
    if (section === "clinicDescription" || section === "expertiseSummary") return clampStr(value, 600);
    if (section === "seoTitle") return clampStr(value, 70);
    if (section === "seoDescription") return clampStr(value, 160);
    if (section === "services" && Array.isArray(value)) {
      if (targetType === AiTargetType.HOSPITAL && Array.isArray(hospitalSpecialties) && hospitalSpecialties.length > 0) {
        return reconcileHospitalServicesWithSpecialties(
          hospitalSpecialties,
          value.map((item: any) => ({
            title: clampStr(item?.title, 100),
            description: clampStr(item?.description, 120),
          })),
          city
        );
      }
      const maxItems = targetType === AiTargetType.HOSPITAL ? 60 : 12;
      return value.slice(0, maxItems).map((item: any) => ({
        title: clampStr(item?.title, 45),
        description: clampStr(item?.description, 120),
      }));
    }
    if (section === "departments" && Array.isArray(value) && targetType === AiTargetType.HOSPITAL && Array.isArray(hospitalSpecialties) && hospitalSpecialties.length > 0) {
      return reconcileHospitalDepartmentsWithSpecialties(hospitalSpecialties, value, city);
    }
    if (section === "faqs" && Array.isArray(value)) {
      return value.slice(0, 10).map((item: any) => ({
        question: clampStr(item?.question, 200),
        answer: clampStr(item?.answer, 600),
      }));
    }
    return value;
  }

  /**
   * Regenerates a single section using entity registration data, enforcing Superadmin permission,
   * daily quota (5/day), 10s cooldown, and strict character/item limits.
   */
  public async regenerateSection(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId,
    section: string,
    user?: AuthUserPayload
  ): Promise<{
    record: IAIContent;
    regeneratedValue: any;
    section: string;
    remainingToday: number;
    dailyLimit: number;
  }> {
    const isEnabled = await this.checkAiRegenerateEnabled(targetType, targetId);
    if (!isEnabled) {
      const err: any = new Error(
        "AI Content Regeneration is currently disabled by Superadmin for this website."
      );
      err.status = 403;
      throw err;
    }

    const record = await this.getOrCreateRecord(targetType, targetId);

    const nowMs = Date.now();
    const cutoff = nowMs - 24 * 60 * 60 * 1000;
    const recentTimestamps = (record.regenerationTimestamps || []).filter(
      (d) => new Date(d).getTime() > cutoff
    );

    const DAILY_LIMIT = 5;
    if (recentTimestamps.length >= DAILY_LIMIT) {
      const err: any = new Error(
        `Daily AI regeneration limit (${DAILY_LIMIT}/day) reached for this website. Please try again after 24 hours.`
      );
      err.status = 429;
      throw err;
    }

    const latestTs =
      recentTimestamps.length > 0
        ? Math.max(...recentTimestamps.map((d) => new Date(d).getTime()))
        : 0;
    if (latestTs && nowMs - latestTs < 10000) {
      const err: any = new Error(
        "Please wait a few seconds before regenerating another section."
      );
      err.status = 429;
      throw err;
    }

    if (record.status === AiContentStatus.GENERATING) {
      const err: any = new Error("Generation is currently in progress for this entity");
      err.status = 409;
      throw err;
    }

    const baseContent =
      record.publishedContent ||
      record.approvedContent ||
      record.draftContent ||
      (await this.buildDefaultContent(targetType, record.targetId));

    const previousStatus = record.status;
    record.status = AiContentStatus.GENERATING;
    await record.save();

    try {
      const { sourceData, orgDoc } = await this.gatherSourceData(targetType, targetId);
      const rawRegenerated = await geminiService.regenerateSection(
        targetType,
        section,
        sourceData,
        baseContent
      );
      const hospitalSpecialties =
        targetType === AiTargetType.HOSPITAL ? resolveOrganizationSpecialties(orgDoc) : undefined;
      const regeneratedValue = this.clampRegeneratedSection(
        targetType,
        section,
        rawRegenerated,
        hospitalSpecialties,
        orgDoc?.address?.city
      );

      const updatedDraft = {
        ...baseContent,
        [section]: regeneratedValue,
      };

      record.draftContent = updatedDraft;
      record.version += 1;
      record.status = previousStatus === AiContentStatus.PUBLISHED ? AiContentStatus.PUBLISHED : AiContentStatus.DRAFT;
      record.lastError = null;
      record.regenerationTimestamps = [...recentTimestamps, new Date(nowMs)];

      record.history.push({
        version: record.version,
        status: record.status,
        content: updatedDraft,
        sectionRegenerated: section,
        actorId: toSafeObjectId(user?.userId),
        actorRole: user?.role,
        action: "REGENERATE_SECTION",
        createdAt: new Date(),
      });

      await record.save();
      return {
        record,
        regeneratedValue,
        section,
        remainingToday: Math.max(0, DAILY_LIMIT - record.regenerationTimestamps.length),
        dailyLimit: DAILY_LIMIT,
      };
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

    const contentToApprove: Record<string, any> = {
      ...(editedContent || record.draftContent || {}),
    };

    if (targetType === AiTargetType.HOSPITAL) {
      const objectId = await this.resolveObjectId(targetType, targetId);
      const org = await Organization.findById(objectId).select("specialties departments address").lean();
      const orgSpecs = resolveOrganizationSpecialties(org);
      if (orgSpecs.length > 0) {
        const svcs = Array.isArray(contentToApprove.services) ? contentToApprove.services : [];
        if (svcs.length !== orgSpecs.length) {
          throw new Error(
            `Hospital services count (${svcs.length}) must match selected Specialties (${orgSpecs.length}). Add or remove items only in the Specialties section.`
          );
        }
        contentToApprove.services = reconcileHospitalServicesWithSpecialties(orgSpecs, svcs, org?.address?.city);
        contentToApprove.departments = reconcileHospitalDepartmentsWithSpecialties(
          orgSpecs,
          Array.isArray(contentToApprove.departments) ? contentToApprove.departments : [],
          org?.address?.city
        );
      }
    }

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
        const orgSpecs = resolveOrganizationSpecialties(orgDoc);
        const effectiveSpecs = orgSpecs.length > 0 ? orgSpecs : ["General Medicine"];
        return {
          heroBadge: "Multi-Specialty Healthcare",
          tagline: `Advanced Medical Care & Compassionate Healing at ${hospitalName}`,
          about: orgDoc?.about || `${hospitalName} is a premier healthcare institution in ${city}, providing comprehensive clinical services with modern medical infrastructure and experienced specialists.`,
          hospitalIntro: `${hospitalName} delivers round-the-clock emergency care, advanced diagnostics, and multi-specialty clinical excellence.`,
          departments: reconcileHospitalDepartmentsWithSpecialties(effectiveSpecs, [], city),
          services: reconcileHospitalServicesWithSpecialties(effectiveSpecs, [], city),
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

    const nextContent = { ...content };
    sanitizeAndValidateWebsiteLayoutConfig(targetType, nextContent);

    if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId).select("specialties departments address").lean();
      const orgSpecs = resolveOrganizationSpecialties(org);
      if (orgSpecs.length > 0) {
        const incomingSvcs = Array.isArray(nextContent.services) ? nextContent.services : [];
        if (incomingSvcs.length !== orgSpecs.length) {
          throw new Error(
            `Hospital services count (${incomingSvcs.length}) cannot differ from selected Specialties (${orgSpecs.length}). Add or remove specialties only in the Specialties section.`
          );
        }
        nextContent.services = reconcileHospitalServicesWithSpecialties(orgSpecs, incomingSvcs, org?.address?.city);
        nextContent.departments = reconcileHospitalDepartmentsWithSpecialties(
          orgSpecs,
          Array.isArray(nextContent.departments) ? nextContent.departments : [],
          org?.address?.city
        );
      }
    }

    record.draftContent = nextContent;
    record.approvedContent = nextContent;
    record.publishedContent = nextContent;
    record.status = AiContentStatus.PUBLISHED;
    record.version += 1;
    record.reviewedBy = toSafeObjectId(user?.userId);
    record.publishedBy = toSafeObjectId(user?.userId);

    record.history.push({
      version: record.version,
      status: AiContentStatus.PUBLISHED,
      content: nextContent,
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
        if (nextContent.about) doctor.bio = nextContent.about;
        await doctor.save();
      }

      const website = await Website.findOne({
        $or: [{ doctorId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: nextContent.seoTitle || website.seoMetadata?.title,
          description: nextContent.seoDescription || website.seoMetadata?.description,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL) {
      const org = await Organization.findById(objectId);
      if (org) {
        if (nextContent.about) org.about = nextContent.about;
        await org.save();
      }

      const website = await Website.findOne({
        $or: [{ organizationId: objectId }, { ownerId: objectId }],
      });
      if (website) {
        website.seoMetadata = {
          ...website.seoMetadata,
          title: nextContent.seoTitle || website.seoMetadata?.title,
          description: nextContent.seoDescription || website.seoMetadata?.description,
        };
        website.aiContentStatus = "APPROVED";
        await website.save();
      }
    } else if (targetType === AiTargetType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(objectId);
      if (doctor) {
        if (nextContent.about) doctor.bio = nextContent.about;
        await doctor.save();
      }
    }

    return record;
  }
}

export const aiContentService = new AIContentService();
