import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { AuthService } from "@/services/auth.service";
import { OtpService } from "@/services/otp.service";
import { MediaService } from "@/services/media.service";
import { logAuditEvent } from "@/services/audit.service";
import { getEnv } from "@/config/env";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSendOtpSchema,
  forgotPasswordVerifyOtpSchema,
  forgotPasswordResetSchema,
} from "@/validations";
import { authRateLimiter } from "@/middleware/rate-limiter";
import { requireAuthenticatedUser } from "@/middleware/auth";
import {
  Website,
  Doctor,
  Organization,
  User,
  Appointment,
  AIContent,
  Review,
  ChatbotConversation,
  PlatformConfig,
} from "@/models";
import { UserRole } from "@/types";

export const authRouter = Router();

async function verifyUserAuthorizationForSlug(
  user: {
    role: UserRole;
    userId: string;
    doctorProfileId?: string | null;
    organizationId?: string | null;
    email?: string;
  },
  targetSlug: string,
  doctorSlug?: string
): Promise<boolean> {
  if (user.role === UserRole.SUPERADMIN) {
    return true;
  }

  // Load fresh user data from database to handle unlinked JWT claims
  const dbUser = await User.findById(user.userId).catch(() => null);
  const effectiveRole = dbUser?.role || user.role;
  const effectiveEmail = (dbUser?.email || user.email || "").toLowerCase().trim();
  const effectiveDoctorId = (dbUser?.doctorProfileId || user.doctorProfileId)?.toString();
  const effectiveOrgId = (dbUser?.organizationId || user.organizationId)?.toString();

  // Search by doctor slugs
  const doctorSearchSlugs = doctorSlug ? [doctorSlug] : [targetSlug];
  const doc = await Doctor.findOne({ slug: { $in: doctorSearchSlugs } });
  const org = await Organization.findOne({ slug: targetSlug });

  // 1. Strict Only Doctor Portal Isolation (e.g. /dr-parth-kadiya/admin)
  if (doc && !doc.organizationId && !doctorSlug) {
    if (effectiveRole === UserRole.ONLY_DOCTOR) {
      if (effectiveDoctorId && effectiveDoctorId === doc._id.toString()) return true;
      if (doc.userId && doc.userId.toString() === user.userId) return true;
      if (effectiveEmail && doc.email && doc.email.toLowerCase() === effectiveEmail) return true;
    }
    return false;
  }

  // 2. Strict Hospital Portal Isolation (e.g. /apollo/admin)
  if (org && !doctorSlug) {
    if (effectiveRole === UserRole.HOSPITAL_ADMIN) {
      if (effectiveOrgId && effectiveOrgId === org._id.toString()) return true;
      if (effectiveEmail && org.email && org.email.toLowerCase() === effectiveEmail) return true;
    }
    return false;
  }

  // 3. Strict Affiliated Doctor Portal Isolation (e.g. /apollo/dr-smith/admin)
  if (doc && doc.organizationId && doctorSlug) {
    if (effectiveRole === UserRole.HOSPITAL_DOCTOR) {
      if (effectiveDoctorId && effectiveDoctorId === doc._id.toString()) return true;
      if (doc.userId && doc.userId.toString() === user.userId) return true;
      if (effectiveEmail && doc.email && doc.email.toLowerCase() === effectiveEmail) return true;
    }
    if (effectiveRole === UserRole.HOSPITAL_ADMIN) {
      if (effectiveOrgId && effectiveOrgId === doc.organizationId.toString()) return true;
    }
    return false;
  }

  // Search by website entities
  const websiteSearchSlugs = [
    ...(doctorSlug
      ? [
          `${targetSlug}-${doctorSlug}`,
          `${targetSlug}/${doctorSlug}`,
          doctorSlug,
        ]
      : []),
    targetSlug,
  ];

  const website = await Website.findOne({
    slug: { $in: websiteSearchSlugs },
  });

  if (website) {
    if (effectiveRole === UserRole.ONLY_DOCTOR) {
      if (
        (effectiveDoctorId && website.doctorId?.toString() === effectiveDoctorId) ||
        (effectiveDoctorId && website.ownerId?.toString() === effectiveDoctorId) ||
        website.ownerId?.toString() === user.userId ||
        (doc && (website.doctorId?.toString() === doc._id.toString() || website.ownerId?.toString() === doc._id.toString()))
      ) {
        return true;
      }
    } else if (effectiveRole === UserRole.HOSPITAL_ADMIN) {
      if (
        (effectiveOrgId && website.organizationId?.toString() === effectiveOrgId) ||
        (effectiveOrgId && website.ownerId?.toString() === effectiveOrgId) ||
        website.ownerId?.toString() === user.userId ||
        (org && (website.organizationId?.toString() === org._id.toString() || website.ownerId?.toString() === org._id.toString()))
      ) {
        return true;
      }
    } else if (effectiveRole === UserRole.HOSPITAL_DOCTOR) {
      if (
        (effectiveDoctorId && website.doctorId?.toString() === effectiveDoctorId) ||
        (doc && website.doctorId?.toString() === doc._id.toString())
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function resolveUserDashboardUrl(user: {
  role: UserRole;
  userId: string;
  doctorProfileId?: string | null;
  organizationId?: string | null;
  email?: string;
}): Promise<{
  dashboardUrl: string;
  slug?: string;
  doctorSlug?: string;
  organizationSlug?: string;
}> {
  if (user.role === UserRole.SUPERADMIN) {
    return { dashboardUrl: "/superadmin" };
  }

  // 1. Fetch live user record to ensure newest links are available
  const dbUser = await User.findById(user.userId).catch(() => null);
  const effectiveRole = dbUser?.role || user.role;
  const effectiveEmail = (dbUser?.email || user.email || "").toLowerCase().trim();
  const effectiveDoctorId = (dbUser?.doctorProfileId || user.doctorProfileId)?.toString();
  const effectiveOrgId = (dbUser?.organizationId || user.organizationId)?.toString();

  if (effectiveRole === UserRole.SUPERADMIN) {
    return { dashboardUrl: "/superadmin" };
  }

  // 2. ONLY_DOCTOR Flow
  if (effectiveRole === UserRole.ONLY_DOCTOR) {
    let doc: any = null;
    if (effectiveDoctorId) {
      doc = await Doctor.findById(effectiveDoctorId);
    }
    if (!doc) {
      doc = await Doctor.findOne({ userId: user.userId });
    }
    if (!doc && effectiveEmail) {
      doc = await Doctor.findOne({ email: effectiveEmail, organizationId: null });
      if (!doc) {
        doc = await Doctor.findOne({ email: effectiveEmail });
      }
    }
    if (!doc) {
      const website = await Website.findOne({
        $or: [
          ...(effectiveDoctorId ? [{ doctorId: effectiveDoctorId }] : []),
          { ownerId: user.userId },
        ],
      });
      if (website?.doctorId || website?.ownerId) {
        doc = await Doctor.findById(website.doctorId || website.ownerId);
      }
    }

    if (doc?.slug) {
      // Self-heal: ensure dbUser and doctor cross-references are populated
      if (dbUser && (!dbUser.doctorProfileId || dbUser.doctorProfileId.toString() !== doc._id.toString())) {
        dbUser.doctorProfileId = doc._id;
        await dbUser.save().catch(() => {});
      }
      if (!doc.userId || doc.userId.toString() !== user.userId) {
        doc.userId = user.userId;
        await doc.save().catch(() => {});
      }

      return {
        dashboardUrl: `/${doc.slug}/admin`,
        slug: doc.slug,
        doctorSlug: doc.slug,
      };
    }
  }

  // 3. HOSPITAL_ADMIN Flow
  if (effectiveRole === UserRole.HOSPITAL_ADMIN) {
    let org: any = null;
    if (effectiveOrgId) {
      org = await Organization.findById(effectiveOrgId);
    }
    if (!org && effectiveEmail) {
      org = await Organization.findOne({ email: effectiveEmail });
    }
    if (!org) {
      const website = await Website.findOne({
        $or: [
          ...(effectiveOrgId ? [{ organizationId: effectiveOrgId }] : []),
          { ownerId: user.userId },
        ],
      });
      if (website?.organizationId || website?.ownerId) {
        org = await Organization.findById(website.organizationId || website.ownerId);
      }
    }

    if (org?.slug) {
      // Self-heal: ensure dbUser organizationId is populated
      if (dbUser && (!dbUser.organizationId || dbUser.organizationId.toString() !== org._id.toString())) {
        dbUser.organizationId = org._id;
        await dbUser.save().catch(() => {});
      }

      return {
        dashboardUrl: `/${org.slug}/admin`,
        slug: org.slug,
        organizationSlug: org.slug,
      };
    }
  }

  // 4. HOSPITAL_DOCTOR Flow
  if (effectiveRole === UserRole.HOSPITAL_DOCTOR) {
    let doc: any = null;
    if (effectiveDoctorId) {
      doc = await Doctor.findById(effectiveDoctorId);
    }
    if (!doc && effectiveEmail) {
      doc = await Doctor.findOne({ email: effectiveEmail });
    }
    if (!doc) {
      doc = await Doctor.findOne({ userId: user.userId });
    }

    if (doc?.slug) {
      let org: any = null;
      const targetOrgId = effectiveOrgId || (doc.organizationId ? doc.organizationId.toString() : null);
      if (targetOrgId) {
        org = await Organization.findById(targetOrgId);
      }
      if (!org && doc.organizationId) {
        org = await Organization.findById(doc.organizationId);
      }

      // Self-heal
      if (dbUser && (!dbUser.doctorProfileId || dbUser.doctorProfileId.toString() !== doc._id.toString())) {
        dbUser.doctorProfileId = doc._id;
        if (org && (!dbUser.organizationId || dbUser.organizationId.toString() !== org._id.toString())) {
          dbUser.organizationId = org._id;
        }
        await dbUser.save().catch(() => {});
      }
      if (!doc.userId || doc.userId.toString() !== user.userId) {
        doc.userId = user.userId;
        await doc.save().catch(() => {});
      }

      if (org?.slug && doc.slug) {
        return {
          dashboardUrl: `/${org.slug}/${doc.slug}/admin`,
          slug: org.slug,
          doctorSlug: doc.slug,
          organizationSlug: org.slug,
        };
      }

      return {
        dashboardUrl: `/${doc.slug}/admin`,
        slug: doc.slug,
        doctorSlug: doc.slug,
      };
    }
  }

  // 5. Ultimate Fallback: lookup by user email across Doctor & Organization
  if (effectiveEmail) {
    const doc = await Doctor.findOne({ email: effectiveEmail });
    if (doc?.slug) {
      if (doc.organizationId) {
        const org = await Organization.findById(doc.organizationId);
        if (org?.slug) {
          return {
            dashboardUrl: `/${org.slug}/${doc.slug}/admin`,
            slug: org.slug,
            doctorSlug: doc.slug,
            organizationSlug: org.slug,
          };
        }
      }
      return {
        dashboardUrl: `/${doc.slug}/admin`,
        slug: doc.slug,
        doctorSlug: doc.slug,
      };
    }

    const org = await Organization.findOne({ email: effectiveEmail });
    if (org?.slug) {
      return {
        dashboardUrl: `/${org.slug}/admin`,
        slug: org.slug,
        organizationSlug: org.slug,
      };
    }
  }

  return { dashboardUrl: "/admin/login" };
}

authRouter.post(
  "/register",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = registerSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const { user, token } = await AuthService.register({
        ...validated,
        ipAddress,
        userAgent,
      });

      // Set secure HTTP-only cookie (cross-site in production: sameSite=none, secure=true)
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("doczeno_session", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId ? user.organizationId.toString() : null,
            doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  "/login",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const { user, token } = await AuthService.login(
        validated.email,
        validated.password,
        {
          ipAddress,
          userAgent,
          requiredRole: validated.requiredRole,
          targetSlug: validated.targetSlug,
          doctorSlug: validated.doctorSlug,
        }
      );

      // Enforce role restriction if requested (e.g. SUPERADMIN portal)
      if (validated.requiredRole && user.role !== validated.requiredRole) {
        res.status(403).json({
          success: false,
          error:
            validated.requiredRole === UserRole.SUPERADMIN
              ? "Access denied. Only Platform Superadmins can access this console."
              : "Access denied. Role mismatch for this administration portal.",
          code: "INSUFFICIENT_PERMISSIONS",
        });
        return;
      }

      // Enforce strict tenant authorization if targetSlug is specified
      if (validated.targetSlug && user.role !== UserRole.SUPERADMIN) {
        const isAuthorized = await verifyUserAuthorizationForSlug(
          {
            role: user.role,
            userId: user._id.toString(),
            doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
            organizationId: user.organizationId ? user.organizationId.toString() : null,
            email: user.email,
          },
          validated.targetSlug,
          validated.doctorSlug
        );

        if (!isAuthorized) {
          res.status(403).json({
            success: false,
            error: "You are not authorized for this clinic/hospital admin portal. Please log in through your official clinic URL.",
            code: "TENANT_MISMATCH",
          });
          return;
        }
      }

      // Set secure HTTP-only cookie (cross-site in production: sameSite=none, secure=true)
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("doczeno_session", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const dashboardInfo = await resolveUserDashboardUrl({
        role: user.role,
        userId: user._id.toString(),
        doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
        organizationId: user.organizationId ? user.organizationId.toString() : null,
        email: user.email,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId ? user.organizationId.toString() : null,
            doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
          },
          token,
          dashboardUrl: dashboardInfo.dashboardUrl,
          slug: dashboardInfo.slug,
          doctorSlug: dashboardInfo.doctorSlug,
          organizationSlug: dashboardInfo.organizationSlug,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  "/me",
  requireAuthenticatedUser,
  async (req: Request, res: Response) => {
    const { requiredRole, targetSlug, doctorSlug } = req.query;

    if (requiredRole && req.user!.role !== requiredRole) {
      res.status(403).json({
        success: false,
        error: "Access denied. Insufficient permissions for this portal.",
        code: "FORBIDDEN",
      });
      return;
    }

    if (targetSlug && req.user!.role !== UserRole.SUPERADMIN) {
      const isAuthorized = await verifyUserAuthorizationForSlug(
        req.user!,
        String(targetSlug),
        doctorSlug ? String(doctorSlug) : undefined
      );

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          error: "You are not authorized to access this clinic/hospital admin panel.",
          code: "TENANT_MISMATCH",
        });
        return;
      }
    }

    const dashboardInfo = await resolveUserDashboardUrl(req.user!);

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        authorized: true,
        dashboardUrl: dashboardInfo.dashboardUrl,
        slug: dashboardInfo.slug,
        doctorSlug: dashboardInfo.doctorSlug,
        organizationSlug: dashboardInfo.organizationSlug,
      },
    });
  }
);

authRouter.post("/logout", (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("doczeno_session", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * Public: Step 1 of Forgot Password - Send OTP to registered admin email
 */
authRouter.post(
  "/forgot-password/send-otp",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = forgotPasswordSendOtpSchema.parse(req.body);
      const email = validated.email.toLowerCase().trim();

      let user: any = null;
      if (validated.targetSlug) {
        const candidateUsers = await User.find({ email });
        for (const candidate of candidateUsers) {
          const isAuth = await verifyUserAuthorizationForSlug(
            {
              userId: candidate._id.toString(),
              role: candidate.role,
              email: candidate.email,
              organizationId: candidate.organizationId ? candidate.organizationId.toString() : null,
              doctorProfileId: candidate.doctorProfileId ? candidate.doctorProfileId.toString() : null,
            },
            validated.targetSlug,
            validated.doctorSlug
          );
          if (isAuth) {
            user = candidate;
            break;
          }
        }
      }

      if (!user) {
        user = (await User.findOne({ email, isActive: true })) || (await User.findOne({ email }));
      }

      if (!user) {
        res.status(404).json({
          success: false,
          error: "No administrator account was found with this email address.",
          code: "USER_NOT_FOUND",
        });
        return;
      }

      if (user.role === UserRole.SUPERADMIN) {
        res.status(403).json({
          success: false,
          error: "Superadmin credentials cannot be reset through this portal.",
          code: "FORBIDDEN",
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          success: false,
          error: "This administrator account is inactive. Please contact support.",
          code: "ACCOUNT_INACTIVE",
        });
        return;
      }

      // If targetSlug is specified (e.g. clinic/hospital login), verify this user belongs to this tenant
      if (validated.targetSlug) {
        const isAuthorized = await verifyUserAuthorizationForSlug(
          {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
            organizationId: user.organizationId ? user.organizationId.toString() : null,
            doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
          },
          validated.targetSlug,
          validated.doctorSlug
        );

        if (!isAuthorized) {
          res.status(403).json({
            success: false,
            error: "This email does not belong to an administrator for this clinic/hospital.",
            code: "TENANT_MISMATCH",
          });
          return;
        }
      }

      const otpResult = await OtpService.generateAndSendOtp({
        email,
        name: user.name,
        purpose: "PASSWORD_RESET",
      });

      res.status(200).json({
        success: true,
        message: otpResult.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public: Step 2 of Forgot Password - Verify 6-digit OTP code
 */
authRouter.post(
  "/forgot-password/verify-otp",
  authRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const validated = forgotPasswordVerifyOtpSchema.parse(req.body);
      const email = validated.email.toLowerCase().trim();

      await OtpService.verifyOtp({
        email,
        otp: validated.otp,
        purpose: "PASSWORD_RESET",
      });

      let targetUser: any = null;
      if (validated.targetSlug) {
        const candidateUsers = await User.find({ email });
        for (const candidate of candidateUsers) {
          const isAuth = await verifyUserAuthorizationForSlug(
            {
              userId: candidate._id.toString(),
              role: candidate.role,
              email: candidate.email,
              organizationId: candidate.organizationId ? candidate.organizationId.toString() : null,
              doctorProfileId: candidate.doctorProfileId ? candidate.doctorProfileId.toString() : null,
            },
            validated.targetSlug,
            validated.doctorSlug
          );
          if (isAuth) {
            targetUser = candidate;
            break;
          }
        }
      }

      const { AUTH_SECRET } = getEnv();
      const resetToken = jwt.sign(
        {
          email,
          userId: targetUser ? targetUser._id.toString() : undefined,
          role: targetUser ? targetUser.role : undefined,
          purpose: "PASSWORD_RESET_VERIFIED",
        },
        AUTH_SECRET,
        { expiresIn: "15m" }
      );

      res.status(200).json({
        success: true,
        message: "Verification code confirmed successfully.",
        data: {
          resetToken,
        },
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
 * Public: Step 3 of Forgot Password - Set new password using verified resetToken
 */
authRouter.post(
  "/forgot-password/reset",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = forgotPasswordResetSchema.parse(req.body);
      const email = validated.email.toLowerCase().trim();

      const { AUTH_SECRET } = getEnv();
      let decoded: any;
      try {
        decoded = jwt.verify(validated.resetToken, AUTH_SECRET);
      } catch {
        res.status(400).json({
          success: false,
          error: "Password reset session has expired. Please request a new verification code.",
          code: "TOKEN_EXPIRED",
        });
        return;
      }

      if (decoded.email !== email || decoded.purpose !== "PASSWORD_RESET_VERIFIED") {
        res.status(400).json({
          success: false,
          error: "Invalid or forged reset token for this email address.",
          code: "INVALID_TOKEN",
        });
        return;
      }

      let user: any = null;
      if (decoded.userId) {
        user = await User.findById(decoded.userId);
      } else if (decoded.role) {
        user = await User.findOne({ email, role: decoded.role });
      }
      if (!user) {
        user = await User.findOne({ email });
      }
      if (!user) {
        res.status(404).json({
          success: false,
          error: "Administrator account not found.",
          code: "USER_NOT_FOUND",
        });
        return;
      }

      if (user.role === UserRole.SUPERADMIN) {
        res.status(403).json({
          success: false,
          error: "Superadmin credentials cannot be reset through this portal.",
          code: "FORBIDDEN",
        });
        return;
      }

      // Hash and update password
      const newPasswordHash = await AuthService.hashPassword(validated.newPassword);
      user.passwordHash = newPasswordHash;
      await user.save();

      // Log security audit event
      await logAuditEvent({
        userId: user._id.toString(),
        userEmail: user.email,
        userRole: user.role,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: user._id.toString(),
        organizationId: user.organizationId ? user.organizationId.toString() : null,
        details: { method: "SELF_SERVICE_OTP" },
      });

      res.status(200).json({
        success: true,
        message: "Your password has been reset successfully. You can now log in.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Protected: Step 1 of Change Password - Verify current old password
 */
authRouter.post(
  "/verify-old-password",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      if (req.user.role === UserRole.SUPERADMIN) {
        res.status(403).json({
          success: false,
          error: "Superadmin password cannot be changed through this panel.",
          code: "FORBIDDEN",
        });
        return;
      }

      const { oldPassword } = req.body;
      if (!oldPassword || typeof oldPassword !== "string") {
        res.status(400).json({
          success: false,
          error: "Please enter your current password.",
          code: "INVALID_INPUT",
        });
        return;
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User account not found.",
          code: "USER_NOT_FOUND",
        });
        return;
      }

      const isMatch = await AuthService.verifyPassword(oldPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          error: "Incorrect current password. Please enter your valid current password.",
          code: "PASSWORD_INCORRECT",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Current password verified successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Protected: Step 2 of Change Password - Set new password
 */
authRouter.post(
  "/change-password",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      if (req.user.role === UserRole.SUPERADMIN) {
        res.status(403).json({
          success: false,
          error: "Superadmin password cannot be changed through this panel.",
          code: "FORBIDDEN",
        });
        return;
      }

      const { oldPassword, newPassword, confirmPassword } = req.body;
      if (!oldPassword || !newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          error: "Please provide old password, new password, and confirm password.",
          code: "INVALID_INPUT",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          error: "New password and Confirm password do not match.",
          code: "PASSWORDS_DO_NOT_MATCH",
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: "New password must be at least 6 characters long.",
          code: "PASSWORD_TOO_SHORT",
        });
        return;
      }

      if (
        !/[A-Z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword) ||
        !/[^A-Za-z0-9]/.test(newPassword)
      ) {
        res.status(400).json({
          success: false,
          error:
            "New password must contain at least 1 uppercase letter, 1 number, and 1 special symbol.",
          code: "PASSWORD_COMPLEXITY_FAILED",
        });
        return;
      }

      if (oldPassword === newPassword) {
        res.status(400).json({
          success: false,
          error: "New password cannot be the same as your old password.",
          code: "PASSWORD_REUSED",
        });
        return;
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User account not found.",
          code: "USER_NOT_FOUND",
        });
        return;
      }

      const isMatch = await AuthService.verifyPassword(oldPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          error: "Incorrect current password.",
          code: "PASSWORD_INCORRECT",
        });
        return;
      }

      const newHash = await AuthService.hashPassword(newPassword);
      user.passwordHash = newHash;
      await user.save();

      await logAuditEvent({
        userId: user._id.toString(),
        userEmail: user.email,
        userRole: user.role,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: user._id.toString(),
        organizationId: user.organizationId ? user.organizationId.toString() : null,
        details: { method: "ACCOUNT_SETTINGS_CHANGE" },
      });

      res.status(200).json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Protected: Permanently delete account and all associated website content, media, appointments, etc.
 */
authRouter.delete(
  "/delete-account",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      if (req.user.role === UserRole.SUPERADMIN) {
        res.status(403).json({
          success: false,
          error: "Superadmin account cannot be deleted.",
          code: "SUPERADMIN_CANNOT_BE_DELETED",
        });
        return;
      }

      const { password } = req.body;
      if (!password || typeof password !== "string") {
        res.status(400).json({
          success: false,
          error: "Please provide your account password to confirm permanent deletion.",
          code: "PASSWORD_REQUIRED",
        });
        return;
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User account not found.",
          code: "USER_NOT_FOUND",
        });
        return;
      }

      const isMatch = await AuthService.verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          error: "Incorrect password. Account deletion aborted.",
          code: "PASSWORD_INCORRECT",
        });
        return;
      }

      const ownerIds: (mongoose.Types.ObjectId | string)[] = [user._id];
      const additionalPublicIds: string[] = [];

      let deletedDoctorSitesCount = 0;

      if (user.role === UserRole.ONLY_DOCTOR) {
        const doctor = await Doctor.findOne({
          $or: [{ userId: user._id }, { _id: user.doctorProfileId }],
        });

        if (doctor) {
          ownerIds.push(doctor._id);
          if (doctor.doctorPhoto?.publicId) additionalPublicIds.push(doctor.doctorPhoto.publicId);
          if (doctor.clinicLogo?.publicId) additionalPublicIds.push(doctor.clinicLogo.publicId);
          if (Array.isArray(doctor.clinicPhotos)) {
            doctor.clinicPhotos.forEach((p: any) => {
              if (p?.publicId) additionalPublicIds.push(p.publicId);
            });
          }

          const websiteCount = await Website.countDocuments({
            $or: [{ doctorId: doctor._id }, { ownerId: user._id }],
          });
          if (websiteCount > 0) {
            deletedDoctorSitesCount += 1;
          }

          await Website.deleteMany({ $or: [{ doctorId: doctor._id }, { ownerId: user._id }] });
          await Appointment.deleteMany({ doctorId: doctor._id });
          await Review.deleteMany({ doctorId: doctor._id });
          await AIContent.deleteMany({ $or: [{ doctorId: doctor._id }, { ownerId: user._id }] });
          await ChatbotConversation.deleteMany({
            $or: [{ doctorId: doctor._id }, { "scope.doctorId": doctor._id }],
          });
          await Doctor.findByIdAndDelete(doctor._id);
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
        const doctor = await Doctor.findOne({
          $or: [{ userId: user._id }, { _id: user.doctorProfileId }],
        });

        if (doctor) {
          ownerIds.push(doctor._id);
          if (doctor.doctorPhoto?.publicId) additionalPublicIds.push(doctor.doctorPhoto.publicId);

          const websiteCount = await Website.countDocuments({
            $or: [{ doctorId: doctor._id }, { ownerId: user._id }],
          });
          if (websiteCount > 0) {
            deletedDoctorSitesCount += 1;
          }

          await Website.deleteMany({ $or: [{ doctorId: doctor._id }, { ownerId: user._id }] });
          await Appointment.deleteMany({ doctorId: doctor._id });
          await Review.deleteMany({ doctorId: doctor._id });
          await AIContent.deleteMany({ $or: [{ doctorId: doctor._id }, { ownerId: user._id }] });
          await ChatbotConversation.deleteMany({
            $or: [{ doctorId: doctor._id }, { "scope.doctorId": doctor._id }],
          });
          await Doctor.findByIdAndDelete(doctor._id);
        }
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        const organization = await Organization.findOne({
          $or: [{ ownerId: user._id }, { _id: user.organizationId }],
        });

        if (organization) {
          ownerIds.push(organization._id);
          if (organization.logo?.publicId) additionalPublicIds.push(organization.logo.publicId);
          if (Array.isArray(organization.galleryPhotos)) {
            organization.galleryPhotos.forEach((p: any) => {
              if (p?.publicId) additionalPublicIds.push(p.publicId);
            });
          }

          const hospitalDoctors = await Doctor.find({ organizationId: organization._id });
          for (const hd of hospitalDoctors) {
            ownerIds.push(hd._id);
            if (hd.doctorPhoto?.publicId) additionalPublicIds.push(hd.doctorPhoto.publicId);
            if (hd.userId) {
              ownerIds.push(hd.userId.toString());
              await User.findByIdAndDelete(hd.userId);
            }
          }

          const websiteCount = await Website.countDocuments({
            organizationId: organization._id,
          });
          if (websiteCount > 0) {
            deletedDoctorSitesCount += hospitalDoctors.length || 1;
          }

          await Website.deleteMany({ organizationId: organization._id });
          await Appointment.deleteMany({ organizationId: organization._id });
          await Review.deleteMany({ organizationId: organization._id });
          await AIContent.deleteMany({ organizationId: organization._id });
          await ChatbotConversation.deleteMany({
            $or: [
              { organizationId: organization._id },
              { "scope.organizationId": organization._id },
            ],
          });
          await Doctor.deleteMany({ organizationId: organization._id });
          await Organization.findByIdAndDelete(organization._id);
        }
      }

      // Purge all media from Cloudinary and DB
      await MediaService.purgeAllTenantMedia(ownerIds, additionalPublicIds);

      // Delete the user record itself
      await User.findByIdAndDelete(user._id);

      // Increment deleted count in PlatformConfig for Superadmin visibility
      if (deletedDoctorSitesCount > 0) {
        await PlatformConfig.findOneAndUpdate(
          {},
          { $inc: { deletedDoctorsCount: deletedDoctorSitesCount } },
          { upsert: true }
        );
      }

      // Clear authentication cookie
      const isProd = process.env.NODE_ENV === "production";
      res.clearCookie("doczeno_session", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
      });

      res.status(200).json({
        success: true,
        message:
          "Account and all associated websites, media, and data have been permanently deleted.",
      });
    } catch (error) {
      next(error);
    }
  }
);
