import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  onlyDoctorOnboardingSchema,
  hospitalOnboardingSchema,
  hospitalDoctorOnboardingSchema,
} from "@/validations/onboarding";
import { Organization, Doctor, Website, User, OnboardingDraft } from "@/models";
import { AuthService } from "@/services/auth.service";
import { OtpService } from "@/services/otp.service";
import { PlatformConfigService } from "@/services/platform-config.service";
import { MediaService } from "@/services/media.service";
import { geminiService } from "@/services/gemini.service";
import { UserRole, WebsiteType } from "@/types";
import { RESERVED_SLUGS } from "@/constants/healthcare";
import { authRateLimiter } from "@/middleware/rate-limiter";

const TEMP_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a unique 10-character lowercase alphanumeric temporary slug
 * that has never been used as a slug or tempSlug before.
 */
async function generateUniqueTempSlug(): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    let candidate = "";
    for (let i = 0; i < 10; i++) {
      candidate += TEMP_SLUG_ALPHABET[crypto.randomInt(0, TEMP_SLUG_ALPHABET.length)];
    }

    if (RESERVED_SLUGS.includes(candidate as any)) continue;

    const [existingDoc, existingOrg, existingWebsite] = await Promise.all([
      Doctor.findOne({ $or: [{ slug: candidate }, { tempSlug: candidate }] }).select("_id"),
      Organization.findOne({ slug: candidate }).select("_id"),
      Website.findOne({ slug: candidate }).select("_id"),
    ]);

    if (!existingDoc && !existingOrg && !existingWebsite) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique temporary preview slug. Please try again.");
}

function extractPublicIds(obj: any): string[] {
  const ids: string[] = [];
  function recurse(val: any) {
    if (!val || typeof val !== "object") return;
    if (typeof val.publicId === "string" && val.publicId.trim()) {
      ids.push(val.publicId.trim());
    }
    if (Array.isArray(val)) {
      for (const item of val) recurse(item);
    } else {
      for (const key of Object.keys(val)) {
        recurse(val[key]);
      }
    }
  }
  recurse(obj);
  return Array.from(new Set(ids));
}

export const onboardingRouter = Router();

/**
 * Public: Get active platform root domain and configuration
 */
onboardingRouter.get(
  "/platform-config",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await PlatformConfigService.getConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Send OTP verification code to applicant's email
 */
onboardingRouter.post(
  "/send-otp",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { onboardingCategories } = await PlatformConfigService.getConfig();
      if (!onboardingCategories.portalEnabled) {
        res.status(403).json({
          success: false,
          error: "This Services is off by admin...",
          code: "SERVICE_OFF_BY_ADMIN",
        });
        return;
      }

      const { email, name } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        res.status(400).json({
          success: false,
          error: "Please enter a valid email address.",
          code: "INVALID_EMAIL",
        });
        return;
      }

      const result = await OtpService.generateAndSendOtp({
        email,
        name,
        purpose: "ONBOARDING",
      });

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Verify entered 6-digit OTP code
 */
onboardingRouter.post(
  "/verify-otp",
  authRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({
          success: false,
          error: "Email and 6-digit verification code are required.",
          code: "MISSING_FIELDS",
        });
        return;
      }

      await OtpService.verifyOtp({ email, otp, purpose: "ONBOARDING" });

      res.status(200).json({
        success: true,
        message: "Email verified successfully.",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || "Invalid or expired verification code.",
        code: "INVALID_OTP",
      });
    }
  }
);

/**
 * Public: List active eligible hospitals for the hospital-doctor selection dropdown
 */
onboardingRouter.get(
  "/eligible-hospitals",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const filter: Record<string, any> = {
        status: "ACTIVE",
        isVisibleInDoctorOnboarding: { $ne: false },
      };

      if (q) {
        filter.$or = [
          { name: { $regex: q, $options: "i" } },
          { "address.city": { $regex: q, $options: "i" } },
          { slug: { $regex: q, $options: "i" } },
        ];
      }

      const hospitals = await Organization.find(
        filter,
        "_id name slug type address.city address.state logo specialties workingHours weeklyOff"
      ).sort({ name: 1 });

      res.status(200).json({ success: true, data: { hospitals }, hospitals });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Check if a website slug is valid and available
 */
onboardingRouter.get(
  "/check-slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = typeof req.query.slug === "string" ? req.query.slug.trim().toLowerCase() : "";
      const type = typeof req.query.type === "string" ? req.query.type : "ONLY_DOCTOR";
      const orgId = typeof req.query.orgId === "string" && mongoose.isValidObjectId(req.query.orgId) ? req.query.orgId : undefined;
      const excludeId = typeof req.query.excludeId === "string" && mongoose.isValidObjectId(req.query.excludeId) ? req.query.excludeId : undefined;

      if (!slug || slug.length < 2) {
        res.status(200).json({
          available: false,
          error: "Slug must be at least 2 characters",
        });
        return;
      }

      if (slug.length > 60) {
        res.status(200).json({
          available: false,
          error: "Slug cannot exceed 60 characters",
        });
        return;
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        res.status(200).json({
          available: false,
          error: "Only lowercase alphanumeric characters and single hyphens are allowed",
        });
        return;
      }

      if (RESERVED_SLUGS.includes(slug as any)) {
        res.status(200).json({
          available: false,
          error: "This URL identifier is reserved and cannot be used",
        });
        return;
      }

      // If child doctor of a hospital, check within that specific hospital
      if (type === "HOSPITAL_DOCTOR") {
        if (!orgId) {
          res.status(200).json({
            available: false,
            error: "Please select a parent hospital first",
          });
          return;
        }

        const query: any = {
          organizationId: orgId,
          $or: [{ slug }, { tempSlug: slug }],
        };
        if (excludeId) {
          query._id = { $ne: excludeId };
        }

        const existingDoc = await Doctor.findOne(query);
        if (existingDoc) {
          res.status(200).json({
            available: false,
            error: "This doctor URL slug is already taken in this hospital",
          });
          return;
        }

        res.status(200).json({
          available: true,
          message: "URL slug is available in this hospital",
        });
        return;
      }

      // Check root uniqueness across Organizations, Websites, and autonomous Doctors
      const orgQuery: any = { slug };
      const webQuery: any = { slug };
      const docQuery: any = { organizationId: null, slug };

      if (type === "HOSPITAL" && excludeId) {
        const orgObjId = new mongoose.Types.ObjectId(excludeId);
        orgQuery._id = { $ne: orgObjId };
        webQuery.organizationId = { $ne: orgObjId };
      } else if (type === "ONLY_DOCTOR" && excludeId) {
        const docObjId = new mongoose.Types.ObjectId(excludeId);
        docQuery._id = { $ne: docObjId };
        webQuery.doctorId = { $ne: docObjId };
      }

      const [existingOrg, existingWebsite, existingDoc] = await Promise.all([
        Organization.findOne(orgQuery),
        Website.findOne(webQuery),
        Doctor.findOne(docQuery),
      ]);

      if (existingOrg || existingWebsite || existingDoc) {
        res.status(200).json({
          available: false,
          error: "This website URL is already taken. Please choose another.",
        });
        return;
      }

      res.status(200).json({
        available: true,
        message: "Website URL is available",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Save or update an onboarding draft
 */
onboardingRouter.post(
  "/draft",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { formType, currentStep, formData, email, phone, name, draftId } = req.body;

      if (!formType || !["ONLY_DOCTOR", "HOSPITAL", "HOSPITAL_DOCTOR"].includes(formType)) {
        res.status(400).json({
          success: false,
          error: "Invalid or missing formType. Must be ONLY_DOCTOR, HOSPITAL, or HOSPITAL_DOCTOR.",
        });
        return;
      }

      const stepNum = typeof currentStep === "number" && currentStep >= 1 ? currentStep : 1;
      const cleanFormData = typeof formData === "object" && formData !== null ? formData : {};
      const cleanEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
      const cleanPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
      const cleanName = typeof name === "string" && name.trim() ? name.trim() : null;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day retention

      let draft = null;

      // Try finding by draftId if provided and valid ObjectId
      if (draftId && mongoose.isValidObjectId(draftId)) {
        draft = await OnboardingDraft.findById(draftId);
      }

      // If not found and email is provided, try finding by formType + email
      if (!draft && cleanEmail) {
        draft = await OnboardingDraft.findOne({ formType, email: cleanEmail });
      }

      if (draft) {
        draft.currentStep = stepNum;
        draft.formData = cleanFormData;
        if (cleanEmail) draft.email = cleanEmail;
        if (cleanPhone) draft.phone = cleanPhone;
        if (cleanName) draft.name = cleanName;
        draft.expiresAt = expiresAt;
        await draft.save();
      } else {
        draft = await OnboardingDraft.create({
          formType,
          currentStep: stepNum,
          formData: cleanFormData,
          email: cleanEmail,
          phone: cleanPhone,
          name: cleanName,
          expiresAt,
        });
      }

      res.status(200).json({
        success: true,
        message: "Draft saved successfully",
        data: {
          draftId: draft._id,
          currentStep: draft.currentStep,
          updatedAt: draft.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Retrieve saved onboarding draft
 */
onboardingRouter.get(
  "/draft",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, formType, draftId } = req.query;

      let draft = null;

      if (draftId && typeof draftId === "string" && mongoose.isValidObjectId(draftId)) {
        draft = await OnboardingDraft.findById(draftId);
      } else if (email && formType && typeof email === "string" && typeof formType === "string") {
        draft = await OnboardingDraft.findOne({
          formType,
          email: email.trim().toLowerCase(),
        }).sort({ updatedAt: -1 });
      }

      if (!draft) {
        res.status(404).json({
          success: false,
          error: "No saved draft found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          draftId: draft._id,
          formType: draft.formType,
          currentStep: draft.currentStep,
          formData: draft.formData,
          email: draft.email,
          phone: draft.phone,
          name: draft.name,
          updatedAt: draft.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Delete an onboarding draft and purge any unattached uploaded media
 */
onboardingRouter.delete(
  "/draft",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = (req.query.email || req.body?.email) as string | undefined;
      const formType = (req.query.formType || req.body?.formType) as string | undefined;
      const draftId = (req.query.draftId || req.body?.draftId) as string | undefined;
      const extraPublicIds = (req.body?.publicIds || []) as string[];

      let draftsToDelete: any[] = [];
      if (draftId && typeof draftId === "string" && mongoose.isValidObjectId(draftId)) {
        const d = await OnboardingDraft.findById(draftId);
        if (d) draftsToDelete.push(d);
      } else if (email && formType && typeof email === "string" && typeof formType === "string") {
        draftsToDelete = await OnboardingDraft.find({
          formType,
          email: email.trim().toLowerCase(),
        });
      }

      // Purge media assets uploaded during this abandoned draft session
      for (const draft of draftsToDelete) {
        if (draft.formData) {
          const publicIds = extractPublicIds(draft.formData);
          for (const pid of publicIds) {
            await MediaService.deleteAssetByPublicId(pid).catch(() => {});
          }
        }
        await OnboardingDraft.findByIdAndDelete(draft._id);
      }

      // If client supplied any extra public IDs directly, purge those as well
      if (Array.isArray(extraPublicIds) && extraPublicIds.length > 0) {
        for (const pid of extraPublicIds) {
          if (typeof pid === "string" && pid.trim()) {
            await MediaService.deleteAssetByPublicId(pid.trim()).catch(() => {});
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Draft and unattached media deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Form A: Only Doctor Onboarding
 */
onboardingRouter.post(
  "/only-doctor",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = onlyDoctorOnboardingSchema.parse(req.body);

      if (!validated.isDraft) {
        const { onboardingCategories } = await PlatformConfigService.getConfig();
        if (!onboardingCategories.portalEnabled || !onboardingCategories.onlyDoctor) {
          res.status(403).json({
            success: false,
            error: !onboardingCategories.portalEnabled
              ? "This Services is off by admin..."
              : "This service is temporarily disabled from the admin.",
            code: "SERVICE_TEMPORARILY_DISABLED",
          });
          return;
        }
      }

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
      }

      // Enforce email uniqueness strictly within the ONLY_DOCTOR category
      if (!validated.isDraft) {
        const docEmail = validated.email.toLowerCase().trim();
        const existingOnlyDoctorUser = await User.findOne({
          email: docEmail,
          role: UserRole.ONLY_DOCTOR,
        });
        if (existingOnlyDoctorUser) {
          res.status(409).json({
            success: false,
            error: "This email address is already registered for an Only Doctor practice. Please use another email or log in.",
            code: "EMAIL_ALREADY_EXISTS",
          });
          return;
        }
      }

      // Generate or validate slug
      const slugBase =
        validated.customSlug ||
        `dr-${validated.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      let finalSlug = slugBase;

      const [existingWebsite, existingDoc, existingOrg] = await Promise.all([
        Website.findOne({ slug: finalSlug }),
        Doctor.findOne({ organizationId: null, slug: finalSlug }),
        Organization.findOne({ slug: finalSlug }),
      ]);
      if (existingWebsite || existingDoc || existingOrg) {
        if (validated.customSlug) {
          res.status(409).json({
            success: false,
            error: "The chosen website URL slug is already taken. Please choose another.",
            code: "SLUG_ALREADY_EXISTS",
          });
          return;
        }
        finalSlug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Create Doctor Record (autonomous clinician)
      const doctor = await Doctor.create({
        doctorName: validated.doctorName,
        gender: validated.gender,
        degree: validated.degree,
        specialization: validated.specialization,
        yearsOfExperience: validated.yearsOfExperience,
        whatsApp: validated.whatsApp,
        email: validated.email,
        consultationHours: JSON.stringify(validated.consultationHours),
        weeklyOff: validated.weeklyOff.join(", "),
        appointmentRequired: validated.appointmentRequired,
        doctorPhoto: validated.doctorPhoto,
        clinicName: validated.clinicName,
        address: validated.address,
        clinicLogo: validated.clinicLogo,
        clinicPhotos: validated.clinicPhotos,
        newCaseFee: validated.newCaseFee,
        oldCaseFee: validated.oldCaseFee,
        slug: finalSlug,
        status: validated.isDraft ? "INACTIVE" : "ACTIVE",
        organizationId: null, // Autonomous
      });

      // Create Associated Website Record
      const website = await Website.create({
        websiteType: WebsiteType.ONLY_DOCTOR,
        ownerType: "DOCTOR",
        ownerId: doctor._id,
        doctorId: doctor._id,
        slug: finalSlug,
        templateId: validated.selectedTheme,
        publishStatus: validated.isDraft ? "DRAFT" : "PUBLISHED",
        seoMetadata: {
          title: `Dr. ${doctor.doctorName} — ${doctor.specialization}`,
          description: `Consult Dr. ${doctor.doctorName} (${doctor.degree}), specialist in ${doctor.specialization} at ${validated.clinicName}.`,
        },
      });

      doctor.websiteId = website._id;
      await doctor.save();

      // Mark uploaded media assets as attached permanently
      const doctorAssets = [
        doctor.doctorPhoto,
        doctor.clinicLogo,
        ...(doctor.clinicPhotos || []),
      ];
      await MediaService.markMediaAsAttached(doctorAssets, doctor._id, "DOCTOR");

      // Create or update User account for only doctor administration if password provided
      let userRecord: any;

      if (!validated.isDraft && validated.password) {
        const targetAdminEmail = (validated.adminEmail || validated.email).toLowerCase().trim();
        const passwordHash = await AuthService.hashPassword(validated.password);

        try {
          userRecord = await User.create({
            name: validated.doctorName,
            email: targetAdminEmail,
            passwordHash,
            role: UserRole.ONLY_DOCTOR,
            doctorProfileId: doctor._id,
            isActive: true,
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            userRecord = await User.findOneAndUpdate(
              { email: targetAdminEmail, role: UserRole.ONLY_DOCTOR },
              {
                name: validated.doctorName,
                passwordHash,
                role: UserRole.ONLY_DOCTOR,
                doctorProfileId: doctor._id,
                isActive: true,
              },
              { new: true }
            );
          } else {
            throw err;
          }
        }

        if (userRecord) {
          doctor.userId = userRecord._id;
          await doctor.save();
        }

        // Security: Do NOT issue an automatic session token on public website creation.
        // The doctor must authenticate with their email and password on their first admin login.
        const isProd = process.env.NODE_ENV === "production";
        res.clearCookie("doczeno_session", {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
        });
      }

      if (!validated.isDraft && validated.email) {
        await OnboardingDraft.deleteMany({ formType: "ONLY_DOCTOR", email: validated.email.toLowerCase() }).catch(() => {});
      }

      const { platformDomain } = await PlatformConfigService.getConfig();
      const publicUrl = `${platformDomain}/${finalSlug}`;

      res.status(201).json({
        success: true,
        message: validated.isDraft
          ? "Only doctor profile saved as draft"
          : "Only doctor website published successfully",
        publicUrl,
        data: {
          doctor,
          website,
          user: userRecord
            ? {
                id: userRecord._id,
                email: userRecord.email,
                role: userRecord.role,
              }
            : undefined,
          token: undefined,
          publicUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Form B: Hospital / Clinic Organization Onboarding
 */
onboardingRouter.post(
  "/hospital",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = hospitalOnboardingSchema.parse(req.body);

      if (!validated.isDraft) {
        const { onboardingCategories } = await PlatformConfigService.getConfig();
        if (!onboardingCategories.portalEnabled || !onboardingCategories.hospital) {
          res.status(403).json({
            success: false,
            error: !onboardingCategories.portalEnabled
              ? "This Services is off by admin..."
              : "This service is temporarily disabled from the admin.",
            code: "SERVICE_TEMPORARILY_DISABLED",
          });
          return;
        }
      }

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
      }

      // Enforce email uniqueness strictly within the HOSPITAL_ADMIN category
      if (!validated.isDraft) {
        const adminEmail = (validated.adminEmail || validated.email).toLowerCase().trim();
        const existingHospitalUser = await User.findOne({
          email: adminEmail,
          role: UserRole.HOSPITAL_ADMIN,
        });
        if (existingHospitalUser) {
          res.status(409).json({
            success: false,
            error: "This email address is already registered as a Hospital/Clinic administrator. Please use another email or log in.",
            code: "EMAIL_ALREADY_EXISTS",
          });
          return;
        }
      }

      // Verify unique slug across Organization, Website, and autonomous Doctors
      const [existingOrg, existingWebsite, existingDoc] = await Promise.all([
        Organization.findOne({ slug: validated.slug }),
        Website.findOne({ slug: validated.slug }),
        Doctor.findOne({ organizationId: null, slug: validated.slug }),
      ]);
      if (existingOrg || existingWebsite || existingDoc) {
        res.status(409).json({
          success: false,
          error: "This website URL slug is already taken. Please choose another.",
          code: "SLUG_ALREADY_EXISTS",
        });
        return;
      }

      // Generate AI About narrative based on specialties if not supplied
      let finalAbout = validated.about?.trim();
      if (!finalAbout) {
        const specs =
          validated.specialties && validated.specialties.length > 0
            ? validated.specialties.join(", ")
            : "general medicine and clinical healthcare services";

        try {
          const aiAbout = await geminiService.generateHospitalAbout({
            hospitalName: validated.hospitalName,
            type: validated.type,
            specialties: validated.specialties,
            city: validated.address?.city,
          });
          if (aiAbout && aiAbout.trim().length >= 20) {
            finalAbout = aiAbout.trim();
          }
        } catch (aiErr) {
          console.warn("[Onboarding] AI About generation warning:", aiErr);
        }

        if (!finalAbout) {
          finalAbout = `${validated.hospitalName} is a leading ${validated.type === "CLINIC" ? "healthcare clinic" : "multispecialty hospital"} committed to delivering patient-centric medical excellence and advanced clinical care. With dedicated medical departments specializing in ${specs}, our facility provides modern diagnostic facilities, compassionate healthcare, and experienced clinicians to ensure high-quality care for our community.`;
        }
      }

      // Create Hospital Organization
      const organization = await Organization.create({
        name: validated.hospitalName,
        type: validated.type,
        slug: validated.slug,
        specialties: validated.specialties || [],
        about: finalAbout,
        phone: validated.phone,
        whatsApp: validated.whatsApp,
        email: validated.email,
        address: validated.address,
        workingHours: JSON.stringify(validated.workingHours),
        weeklyOff: validated.weeklyOff.join(", "),
        appointmentRequired: validated.appointmentRequired,
        logo: validated.logo,
        buildingPhoto: validated.buildingPhoto,
        galleryPhotos: validated.galleryPhotos,
        selectedTheme: validated.selectedTheme,
        browserTabTitle: `${validated.hospitalName} — Healthcare & Clinics`,
        status: validated.isDraft ? "INACTIVE" : "ACTIVE",
      });

      // Create Hospital Admin User
      const rawPassword = validated.password || validated.adminPassword || `${crypto.randomBytes(16).toString("hex")}A1!`;
      const passwordHash = await AuthService.hashPassword(rawPassword);
      const adminEmail = (validated.adminEmail || validated.email).toLowerCase();

      let adminUser: any;
      try {
        adminUser = await User.create({
          name: validated.adminName,
          email: adminEmail,
          passwordHash,
          role: UserRole.HOSPITAL_ADMIN,
          organizationId: organization._id,
          isActive: true,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          adminUser = await User.findOneAndUpdate(
            { email: adminEmail, role: UserRole.HOSPITAL_ADMIN },
            {
              name: validated.adminName,
              passwordHash,
              role: UserRole.HOSPITAL_ADMIN,
              organizationId: organization._id,
              isActive: true,
            },
            { new: true }
          );
        } else {
          throw err;
        }
      }

      // Create Hospital Website
      const website = await Website.create({
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        ownerType: "ORGANIZATION",
        ownerId: organization._id,
        organizationId: organization._id,
        slug: validated.slug,
        templateId: validated.selectedTheme,
        publishStatus: validated.isDraft ? "DRAFT" : "PUBLISHED",
        seoMetadata: {
          title: organization.name,
          description: organization.about,
        },
      });

      // Mark uploaded hospital assets as attached permanently
      const hospitalAssets = [
        organization.logo,
        organization.buildingPhoto,
        ...(organization.galleryPhotos || []),
      ];
      await MediaService.markMediaAsAttached(hospitalAssets, organization._id, "ORGANIZATION");

      // Security: Do NOT issue an automatic session token on public website creation.
      // The hospital admin must authenticate with email & password on first login.
      const isProd = process.env.NODE_ENV === "production";
      res.clearCookie("doczeno_session", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
      });

      if (!validated.isDraft) {
        const targetEmail = (validated.adminEmail || validated.email).toLowerCase();
        await OnboardingDraft.deleteMany({ formType: "HOSPITAL", email: targetEmail }).catch(() => {});
      }

      const { platformDomain } = await PlatformConfigService.getConfig();
      const publicUrl = `${platformDomain}/${organization.slug}`;

      res.status(201).json({
        success: true,
        message: validated.isDraft
          ? "Hospital profile saved as draft"
          : "Hospital website created successfully",
        publicUrl,
        data: {
          organization,
          website,
          adminUser: {
            id: adminUser._id,
            email: adminUser.email,
            role: adminUser.role,
          },
          token: undefined,
          publicUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Form C: Hospital Doctor Onboarding (Affiliated Clinician)
 */
onboardingRouter.post(
  "/hospital-doctor",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = hospitalDoctorOnboardingSchema.parse(req.body);

      const isAdminActor = Boolean(
        req.user &&
          (req.user.role === UserRole.HOSPITAL_ADMIN || req.user.role === UserRole.SUPERADMIN)
      );
      if (!validated.isDraft && !isAdminActor) {
        const { onboardingCategories } = await PlatformConfigService.getConfig();
        if (!onboardingCategories.portalEnabled || !onboardingCategories.hospitalDoctor) {
          res.status(403).json({
            success: false,
            error: !onboardingCategories.portalEnabled
              ? "This Services is off by admin..."
              : "This service is temporarily disabled from the admin.",
            code: "SERVICE_TEMPORARILY_DISABLED",
          });
          return;
        }
      }

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
      }

      // Enforce email uniqueness strictly within the HOSPITAL_DOCTOR category
      if (!validated.isDraft) {
        const docEmail = validated.email.toLowerCase().trim();
        const existingHospitalDoctorUser = await User.findOne({
          email: docEmail,
          role: UserRole.HOSPITAL_DOCTOR,
        });
        if (existingHospitalDoctorUser) {
          res.status(409).json({
            success: false,
            error: "This email address is already registered as a Hospital-Affiliated Doctor. Please use another email or log in.",
            code: "EMAIL_ALREADY_EXISTS",
          });
          return;
        }
      }

      // 1. Re-verify organization exists and is active
      const parentHospital = await Organization.findById(validated.organizationId);
      if (!parentHospital || parentHospital.status !== "ACTIVE") {
        res.status(400).json({
          success: false,
          error: "Selected hospital organization is invalid or inactive",
          code: "INVALID_ORGANIZATION_ID",
        });
        return;
      }

      if (!validated.isDraft && !isAdminActor && parentHospital.isVisibleInDoctorOnboarding === false) {
        res.status(403).json({
          success: false,
          error: "This hospital/clinic is currently hidden from public doctor registration. Please contact the administrator.",
          code: "HOSPITAL_HIDDEN_FROM_ONBOARDING",
        });
        return;
      }

      // 1b. Enforce doctor specialization belongs to parent hospital's registered departments
      if (
        Array.isArray(parentHospital.specialties) &&
        parentHospital.specialties.length > 0 &&
        !parentHospital.specialties.includes(validated.specialization)
      ) {
        res.status(400).json({
          success: false,
          error: `Selected specialization '${validated.specialization}' is not offered by ${parentHospital.name}. Please select an offered department.`,
          code: "INVALID_SPECIALIZATION_FOR_HOSPITAL",
        });
        return;
      }

      // 1c. Enforce doctor consultation hours cannot be scheduled on days when parent hospital is closed (weekly off)
      const hospitalOffDays = new Set<string>();
      if (parentHospital.weeklyOff) {
        parentHospital.weeklyOff
          .split(",")
          .map((d: string) => d.trim().toLowerCase())
          .filter(Boolean)
          .forEach((d: string) => hospitalOffDays.add(d));
      }
      if (parentHospital.workingHours) {
        try {
          const parsed = JSON.parse(parentHospital.workingHours);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (s.isClosed && s.day) {
                hospitalOffDays.add(String(s.day).trim().toLowerCase());
              }
            });
          }
        } catch {}
      }

      if (hospitalOffDays.size > 0 && Array.isArray(validated.consultationHours)) {
        for (const sched of validated.consultationHours) {
          if (!sched.isClosed && sched.day && hospitalOffDays.has(sched.day.trim().toLowerCase())) {
            res.status(400).json({
              success: false,
              error: `Doctor cannot set consultation hours on ${sched.day} because ${parentHospital.name} is closed on this day (Hospital Weekly Off).`,
              code: "HOSPITAL_CLOSED_ON_SELECTED_DAY",
            });
            return;
          }
        }
      }

      // 2. Cross-tenant check: If created by an authenticated Hospital Admin, ensure match
      if (req.user && req.user.role === UserRole.HOSPITAL_ADMIN) {
        if (!req.user.organizationId || req.user.organizationId !== validated.organizationId) {
          res.status(403).json({
            success: false,
            error: "Forbidden: You cannot register a doctor to a different hospital",
            code: "CROSS_TENANT_ORGANIZATION_ASSIGNMENT",
          });
          return;
        }
      }

      // 3. Generate child slug: <hospital-slug>/<doctor-slug>
      const docSlugBase =
        validated.customSlug ||
        `dr-${validated.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      let finalDocSlug = docSlugBase;

      const existingDoc = await Doctor.findOne({
        organizationId: parentHospital._id,
        $or: [{ slug: finalDocSlug }, { tempSlug: finalDocSlug }],
      });
      if (existingDoc) {
        if (validated.customSlug) {
          res.status(409).json({
            success: false,
            error: "This doctor URL slug is already taken in this hospital. Please choose another.",
            code: "SLUG_ALREADY_EXISTS",
          });
          return;
        }
        finalDocSlug = `${docSlugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const childWebsiteSlug = `${parentHospital.slug}-${finalDocSlug}`;

      const isCreatedByHospitalAdmin = Boolean(
        req.user &&
          req.user.role === UserRole.HOSPITAL_ADMIN &&
          req.user.organizationId === validated.organizationId
      );
      const requiresApproval = !validated.isDraft && !isCreatedByHospitalAdmin;
      const tempSlug = requiresApproval ? await generateUniqueTempSlug() : undefined;

      // 4. Create child Doctor record WITHOUT duplicating hospital address, logo, gallery, or theme
      const doctor = await Doctor.create({
        doctorName: validated.doctorName,
        gender: validated.gender,
        degree: validated.degree,
        specialization: validated.specialization,
        yearsOfExperience: validated.yearsOfExperience,
        whatsApp: validated.whatsApp,
        email: validated.email,
        consultationHours: JSON.stringify(validated.consultationHours),
        weeklyOff: validated.weeklyOff.join(", "),
        appointmentRequired: validated.appointmentRequired,
        doctorPhoto: validated.doctorPhoto,
        newCaseFee: validated.newCaseFee,
        oldCaseFee: validated.oldCaseFee,
        organizationId: parentHospital._id, // Child relation
        slug: finalDocSlug,
        tempSlug,
        approvalStatus: requiresApproval ? "PENDING" : "APPROVED",
        approvedAt: requiresApproval ? undefined : new Date(),
        status: validated.isDraft || requiresApproval ? "INACTIVE" : "ACTIVE",
      });

      // 5. Create Child Website Entity
      const website = await Website.create({
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        ownerType: "DOCTOR",
        ownerId: doctor._id,
        doctorId: doctor._id,
        organizationId: parentHospital._id,
        slug: childWebsiteSlug,
        templateId: parentHospital.selectedTheme, // Inherited theme
        publishStatus: validated.isDraft ? "DRAFT" : requiresApproval ? "REVIEW" : "PUBLISHED",
        seoMetadata: {
          title: `Dr. ${doctor.doctorName} — ${parentHospital.name}`,
          description: `Consult Dr. ${doctor.doctorName} (${doctor.specialization}) at ${parentHospital.name}, ${parentHospital.address.city}.`,
        },
      });

      doctor.websiteId = website._id;
      await doctor.save();

      // Mark uploaded doctor photo as attached permanently
      await MediaService.markMediaAsAttached([doctor.doctorPhoto], doctor._id, "DOCTOR");

      // Create or update User account for affiliated doctor if password provided
      let docUserRecord: any;

      if (!validated.isDraft && validated.password) {
        const passwordHash = await AuthService.hashPassword(validated.password);
        const targetAdminEmail = (validated.adminEmail || validated.email).toLowerCase().trim();

        try {
          docUserRecord = await User.create({
            name: validated.doctorName,
            email: targetAdminEmail,
            passwordHash,
            role: UserRole.HOSPITAL_DOCTOR,
            organizationId: parentHospital._id,
            doctorProfileId: doctor._id,
            isActive: true,
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            docUserRecord = await User.findOneAndUpdate(
              { email: targetAdminEmail, role: UserRole.HOSPITAL_DOCTOR },
              {
                name: validated.doctorName,
                passwordHash,
                role: UserRole.HOSPITAL_DOCTOR,
                organizationId: parentHospital._id,
                doctorProfileId: doctor._id,
                isActive: true,
              },
              { new: true }
            );
          } else {
            throw err;
          }
        }

        if (docUserRecord) {
          doctor.userId = docUserRecord._id;
          await doctor.save();
        }

        // Security: Do NOT issue an automatic session token on public website creation.
        // The doctor must authenticate with email & password on first login.
        const isProd = process.env.NODE_ENV === "production";
        res.clearCookie("doczeno_session", {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
        });
      }

      if (!validated.isDraft && validated.email) {
        await OnboardingDraft.deleteMany({ formType: "HOSPITAL_DOCTOR", email: validated.email.toLowerCase() }).catch(() => {});
      }

      const { platformDomain } = await PlatformConfigService.getConfig();
      const publicUrl = requiresApproval ? "" : `${platformDomain}/${parentHospital.slug}/${finalDocSlug}`;

      // Never expose tempSlug in the public onboarding response
      const safeDoctorResponse = doctor.toObject();
      delete (safeDoctorResponse as any).tempSlug;

      res.status(201).json({
        success: true,
        pendingApproval: requiresApproval,
        message: validated.isDraft
          ? "Hospital doctor profile saved as draft"
          : requiresApproval
          ? "Your request is sent to the admin for approval, kindly wait some time."
          : "Hospital doctor profile published successfully",
        publicUrl,
        data: {
          doctor: safeDoctorResponse,
          website,
          pendingApproval: requiresApproval,
          requestedSlug: finalDocSlug,
          user: docUserRecord
            ? {
                id: docUserRecord._id,
                email: docUserRecord.email,
                role: docUserRecord.role,
              }
            : undefined,
          token: undefined,
          publicUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
