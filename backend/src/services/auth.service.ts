import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser } from "@/models";
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
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic error to prevent account enumeration
    if (!user || !user.isActive) {
      throw new Error("Invalid email or password");
    }

    const validPassword = await this.verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      await logAuditEvent({
        userId: user._id.toString(),
        userEmail: user.email,
        userRole: user.role,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user._id.toString(),
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

    const existing = await User.findOne({ email: SUPERADMIN_EMAIL.toLowerCase() });
    if (!existing) {
      const passwordHash = await this.hashPassword(SUPERADMIN_PASSWORD);
      await User.create({
        email: SUPERADMIN_EMAIL.toLowerCase(),
        passwordHash,
        name: "Platform Superadmin",
        role: UserRole.SUPERADMIN,
        isActive: true,
      });
    }
  }
}
