import { Router, Request, Response, NextFunction } from "express";
import {
  independentDoctorOnboardingSchema,
  hospitalOnboardingSchema,
  hospitalDoctorOnboardingSchema,
} from "@/validations/onboarding";
import { Organization, Doctor, Website, User } from "@/models";
import { AuthService } from "@/services/auth.service";
import { OtpService } from "@/services/otp.service";
import { UserRole, WebsiteType } from "@/types";

export const onboardingRouter = Router();

/**
 * Public: Send OTP verification code to applicant's email
 */
onboardingRouter.post(
  "/send-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const hospitals = await Organization.find(
        { status: "ACTIVE" },
        "_id name slug type address.city address.state logo"
      ).sort({ name: 1 });

      res.status(200).json({ success: true, data: { hospitals } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Form A: Independent Doctor Onboarding
 */
onboardingRouter.post(
  "/independent-doctor",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = independentDoctorOnboardingSchema.parse(req.body);

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
      }

      // Generate or validate slug
      const slugBase =
        validated.customSlug ||
        `dr-${validated.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      let finalSlug = slugBase;

      const existingWebsite = await Website.findOne({ slug: finalSlug });
      if (existingWebsite) {
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
        slug: finalSlug,
        status: validated.isDraft ? "INACTIVE" : "ACTIVE",
        organizationId: null, // Autonomous
      });

      // Create Associated Website Record
      const website = await Website.create({
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
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

      // Create or update User account for independent doctor administration if password provided
      let token: string | undefined;
      let userRecord: any;

      if (!validated.isDraft && validated.password) {
        const docEmail = validated.email.toLowerCase();
        const passwordHash = await AuthService.hashPassword(validated.password);

        try {
          userRecord = await User.create({
            name: validated.doctorName,
            email: docEmail,
            passwordHash,
            role: UserRole.INDEPENDENT_DOCTOR,
            doctorProfileId: doctor._id,
            isActive: true,
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            userRecord = await User.findOneAndUpdate(
              { email: docEmail },
              {
                name: validated.doctorName,
                passwordHash,
                role: UserRole.INDEPENDENT_DOCTOR,
                doctorProfileId: doctor._id,
                isActive: true,
              },
              { new: true }
            );
          } else {
            throw err;
          }
        }

        token = AuthService.generateToken(userRecord);

        res.cookie("doczeno_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      const publicUrl = `doctorwebsite.in/${finalSlug}`;

      res.status(201).json({
        success: true,
        message: validated.isDraft
          ? "Independent doctor profile saved as draft"
          : "Independent doctor website published successfully",
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
          token,
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

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
      }

      // Verify unique slug
      const existingOrg = await Organization.findOne({ slug: validated.slug });
      if (existingOrg) {
        res.status(409).json({
          success: false,
          error: "An organization with this slug already exists",
          code: "SLUG_ALREADY_EXISTS",
        });
        return;
      }

      // Create Hospital Organization
      const organization = await Organization.create({
        name: validated.hospitalName,
        type: validated.type,
        slug: validated.slug,
        about: validated.about,
        phone: validated.phone,
        whatsApp: validated.whatsApp,
        email: validated.email,
        address: validated.address,
        workingHours: JSON.stringify(validated.workingHours),
        weeklyOff: validated.weeklyOff.join(", "),
        appointmentRequired: validated.appointmentRequired,
        logo: validated.logo,
        galleryPhotos: validated.galleryPhotos,
        selectedTheme: validated.selectedTheme,
        browserTabTitle: `${validated.hospitalName} — Healthcare & Clinics`,
        status: validated.isDraft ? "INACTIVE" : "ACTIVE",
      });

      // Create Hospital Admin User
      const rawPassword = validated.password || validated.adminPassword || "SecureHospitalPassword123!";
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
            { email: adminEmail },
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

      const token = AuthService.generateToken(adminUser);

      res.cookie("doczeno_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const publicUrl = `doctorwebsite.in/${organization.slug}`;

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
          token,
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

      // Verify OTP if submitted during final publish
      if (!validated.isDraft && validated.otp) {
        await OtpService.verifyOtp({
          email: validated.email,
          otp: validated.otp,
          purpose: "ONBOARDING",
        });
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
      const childWebsiteSlug = `${parentHospital.slug}-${docSlugBase}`;

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
        organizationId: parentHospital._id, // Child relation
        slug: docSlugBase,
        status: validated.isDraft ? "INACTIVE" : "ACTIVE",
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
        publishStatus: validated.isDraft ? "DRAFT" : "PUBLISHED",
        seoMetadata: {
          title: `Dr. ${doctor.doctorName} — ${parentHospital.name}`,
          description: `Consult Dr. ${doctor.doctorName} (${doctor.specialization}) at ${parentHospital.name}, ${parentHospital.address.city}.`,
        },
      });

      doctor.websiteId = website._id;
      await doctor.save();

      // Create or update User account for affiliated doctor if password provided
      let docUserRecord: any;
      let token: string | undefined;

      if (!validated.isDraft && validated.password) {
        const passwordHash = await AuthService.hashPassword(validated.password);
        const docEmail = validated.email.toLowerCase();

        try {
          docUserRecord = await User.create({
            name: validated.doctorName,
            email: docEmail,
            passwordHash,
            role: UserRole.HOSPITAL_DOCTOR,
            organizationId: parentHospital._id,
            doctorProfileId: doctor._id,
            isActive: true,
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            docUserRecord = await User.findOneAndUpdate(
              { email: docEmail },
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

        token = AuthService.generateToken(docUserRecord);

        res.cookie("doczeno_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      const publicUrl = `doctorwebsite.in/${parentHospital.slug}/${docSlugBase}`;

      res.status(201).json({
        success: true,
        message: validated.isDraft
          ? "Hospital doctor profile saved as draft"
          : "Hospital doctor profile published successfully",
        publicUrl,
        data: {
          doctor,
          website,
          user: docUserRecord
            ? {
                id: docUserRecord._id,
                email: docUserRecord.email,
                role: docUserRecord.role,
              }
            : undefined,
          token,
          publicUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
