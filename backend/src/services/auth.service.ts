import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser, Doctor, Organization } from "@/models";
import { getEnv } from "@/config/env";
import { UserRole, AuthUserPayload } from "@/types";
import { logAuditEvent } from "./audit.service";

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(user: IUser): string {
    const { AUTH_SECRET } = getEnv();
    const payload: AuthUserPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      doctorProfileId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
    };

    return jwt.sign(payload, AUTH_SECRET, {
      expiresIn: "7d",
    });
  }

  static async register(input: RegisterUserInput): Promise<{ user: IUser; token: string }> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
      organizationId: input.organizationId || null,
      doctorProfileId: input.doctorProfileId || null,
      isActive: true,
    });

    await logAuditEvent({
      userId: user._id.toString(),
      userEmail: user.email,
      userRole: user.role,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user._id.toString(),
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      doctorId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async login(
    email: string,
    password: string,
    meta?: {
      ipAddress?: string;
      userAgent?: string;
      requiredRole?: UserRole;
      targetSlug?: string;
      doctorSlug?: string;
    }
  ): Promise<{ user: IUser; token: string }> {
    const cleanEmail = email.toLowerCase().trim();
    let candidatesToTest: IUser[] = [];

    // 1. If targetSlug is specified, strictly isolate and resolve candidates for this specific portal
    if (meta?.targetSlug) {
      const doctorSearchSlug = meta.doctorSlug || meta.targetSlug;
      const [doc, org] = await Promise.all([
        Doctor.findOne({ slug: doctorSearchSlug }),
        Organization.findOne({ slug: meta.targetSlug }),
      ]);

      if (doc && !meta.doctorSlug && !doc.organizationId) {
        // ONLY_DOCTOR portal (e.g. /dr-parth-kadiya/admin/login)
        candidatesToTest = await User.find({
          email: cleanEmail,
          role: UserRole.ONLY_DOCTOR,
          isActive: true,
          $or: [
            { doctorProfileId: doc._id },
            { _id: doc.userId },
          ],
        });
        if (candidatesToTest.length === 0) {
          candidatesToTest = await User.find({
            email: cleanEmail,
            role: UserRole.ONLY_DOCTOR,
            isActive: true,
          });
        }
      } else if (org && !meta.doctorSlug) {
        // HOSPITAL_ADMIN portal (e.g. /apollo/admin/login)
        candidatesToTest = await User.find({
          email: cleanEmail,
          role: UserRole.HOSPITAL_ADMIN,
          organizationId: org._id,
          isActive: true,
        });
        if (candidatesToTest.length === 0) {
          candidatesToTest = await User.find({
            email: cleanEmail,
            role: UserRole.HOSPITAL_ADMIN,
            isActive: true,
          });
        }
      } else if (doc && meta.doctorSlug && org) {
        // HOSPITAL_DOCTOR portal (e.g. /apollo/dr-smith/admin/login)
        candidatesToTest = await User.find({
          email: cleanEmail,
          role: UserRole.HOSPITAL_DOCTOR,
          doctorProfileId: doc._id,
          isActive: true,
        });
        if (candidatesToTest.length === 0) {
          // Parent hospital admin is also authorized
          candidatesToTest = await User.find({
            email: cleanEmail,
            role: UserRole.HOSPITAL_ADMIN,
            organizationId: org._id,
            isActive: true,
          });
        }
      }
    }

    // 2. Fallback if no targetSlug specified (general login) or generic lookup
    if (candidatesToTest.length === 0) {
      const candidateQuery: Record<string, any> = { email: cleanEmail, isActive: true };
      if (meta?.requiredRole) {
        candidateQuery.role = meta.requiredRole;
      }
      candidatesToTest = await User.find(candidateQuery);
    }

    const firstCandidate = candidatesToTest[0];
    if (!firstCandidate) {
      const inactiveUser = await User.findOne({ email: cleanEmail });
      if (inactiveUser && !inactiveUser.isActive) {
        throw new Error("This administrator account is inactive. Please contact support.");
      }
      throw new Error("Invalid email or password");
    }

    let user: IUser | null = null;

    // Test password strictly against the portal-qualified candidates
    for (const candidate of candidatesToTest) {
      const isValid = await this.verifyPassword(password, candidate.passwordHash);
      if (isValid) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      await logAuditEvent({
        userId: firstCandidate._id.toString(),
        userEmail: cleanEmail,
        userRole: firstCandidate.role,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: firstCandidate._id.toString(),
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new Error("Invalid email or password");
    }

    await logAuditEvent({
      userId: user._id.toString(),
      userEmail: user.email,
      userRole: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: user._id.toString(),
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      doctorId: user.doctorProfileId ? user.doctorProfileId.toString() : null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async ensureSuperadminSeed(): Promise<void> {
    const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = getEnv();
    if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) return;

    const email = SUPERADMIN_EMAIL.toLowerCase();
    const existing = await User.findOne({ email });
    const passwordHash = await this.hashPassword(SUPERADMIN_PASSWORD);

    if (!existing) {
      await User.create({
        email,
        passwordHash,
        name: "Platform Superadmin",
        role: UserRole.SUPERADMIN,
        isActive: true,
      });
    } else {
      // Industry standard protection: NEVER hijack or overwrite credentials of a doctor or organization account
      if (existing.doctorProfileId || existing.organizationId) {
        return;
      }
      existing.role = UserRole.SUPERADMIN;
      existing.passwordHash = passwordHash;
      existing.isActive = true;
      await existing.save();
    }
  }
}
