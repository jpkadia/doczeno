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
   * Retrieves or creates an AI content record for a target entity
   */
  public async getOrCreateRecord(
    targetType: string,
    targetId: string | mongoose.Types.ObjectId
  ): Promise<IAIContent> {
    const objectId = new mongoose.Types.ObjectId(targetId);
    let record = await AIContent.findOne({ targetType, targetId: objectId });

    if (!record) {
      // Find associated organizationId / doctorId for relational indexing
      let organizationId: mongoose.Types.ObjectId | null = null;
      let doctorId: mongoose.Types.ObjectId | null = null;

      if (targetType === AiTargetType.INDEPENDENT_DOCTOR) {
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

      record = await AIContent.create({
        targetType,
        targetId: objectId,
        organizationId,
        doctorId,
        status: AiContentStatus.NOT_GENERATED,
        version: 0,
        draftContent: null,
        approvedContent: null,
        publishedContent: null,
        history: [],
      });
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
    const objectId = new mongoose.Types.ObjectId(targetId);

    if (targetType === AiTargetType.INDEPENDENT_DOCTOR) {
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

      if (targetType === AiTargetType.INDEPENDENT_DOCTOR) {
        generated = await geminiService.generateIndependentDoctor(sourceData);
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
    const objectId = new mongoose.Types.ObjectId(targetId);

    // Synchronize to domain models
    if (targetType === AiTargetType.INDEPENDENT_DOCTOR) {
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
}

export const aiContentService = new AIContentService();
