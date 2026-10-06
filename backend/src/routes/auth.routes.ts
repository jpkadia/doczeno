import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/auth.service";
import { registerSchema, loginSchema } from "@/validations";
import { authRateLimiter } from "@/middleware/rate-limiter";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { Website, Doctor } from "@/models";
import { UserRole } from "@/types";

export const authRouter = Router();

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

      // Set secure HTTP-only cookie
      res.cookie("doczeno_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
        { ipAddress, userAgent }
      );

      // Enforce strict tenant authorization if targetSlug is specified
      if (validated.targetSlug && user.role !== UserRole.SUPERADMIN) {
        const website = await Website.findOne({ slug: validated.targetSlug });
        let authorized = false;

        if (website) {
          if (user.role === UserRole.INDEPENDENT_DOCTOR) {
            authorized =
              user.doctorProfileId?.toString() === website.doctorId?.toString() ||
              user.doctorProfileId?.toString() === website.ownerId?.toString();
          } else if (user.role === UserRole.HOSPITAL_ADMIN) {
            authorized =
              user.organizationId?.toString() === website.organizationId?.toString() ||
              user.organizationId?.toString() === website.ownerId?.toString();
          } else if (user.role === UserRole.HOSPITAL_DOCTOR) {
            authorized = user.doctorProfileId?.toString() === website.doctorId?.toString();
          }
        } else {
          // Check if targetSlug is a doctor slug
          const doc = await Doctor.findOne({ slug: validated.targetSlug });
          if (doc && user.doctorProfileId?.toString() === doc._id.toString()) {
            authorized = true;
          }
        }

        if (!authorized) {
          res.status(403).json({
            success: false,
            error: "Aap is clinic/hospital ke admin panel ke liye authorized nahi hain. Kripya apne official clinic link par login karein.",
            code: "TENANT_MISMATCH",
          });
          return;
        }
      }

      // Set secure HTTP-only cookie
      res.cookie("doczeno_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
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
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }
);

authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("doczeno_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
