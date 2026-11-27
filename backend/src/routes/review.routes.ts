import { Router, Request, Response, NextFunction } from "express";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { Review, Doctor, Organization } from "@/models";
import { UserRole } from "@/types";
import { geminiService } from "@/services/gemini.service";
import { logAuditEvent } from "@/services/audit.service";

export const reviewRouter = Router();

/**
 * GET /api/v1/reviews
 * Authenticated: Retrieve reviews scoped strictly to current practice
 */
reviewRouter.get(
  "/",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filter: Record<string, unknown> = {};

      if (user.role === UserRole.SUPERADMIN) {
        if (req.query.organizationId) filter.organizationId = req.query.organizationId;
        if (req.query.doctorId) filter.doctorId = req.query.doctorId;
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId) {
          res.status(403).json({ success: false, error: "Missing organization assignment", code: "FORBIDDEN" });
          return;
        }
        filter.organizationId = user.organizationId;
        if (typeof req.query.doctorId === "string" && req.query.doctorId.trim()) {
          const targetDoc = await Doctor.findOne({
            _id: req.query.doctorId.trim(),
            organizationId: user.organizationId,
          }).select("_id");
          if (!targetDoc) {
            res.status(403).json({ success: false, error: "Doctor does not belong to your hospital", code: "FORBIDDEN" });
            return;
          }
          filter.doctorId = targetDoc._id;
        } else if (req.query.scope === "hospital") {
          filter.$or = [{ doctorId: null }, { doctorId: { $exists: false } }];
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId) {
          res.status(403).json({ success: false, error: "Missing doctor profile link", code: "FORBIDDEN" });
          return;
        }
        filter.doctorId = user.doctorProfileId;
      } else {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const reviews = await Review.find(filter).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          reviews: reviews.map((r) => ({
            id: r._id.toString(),
            patientName: r.patientName,
            rating: r.rating,
            comment: r.comment,
            tag: r.tag || "Verified Patient",
            isVerified: r.isVerified,
            isPublished: r.isPublished,
            doctorId: r.doctorId?.toString(),
            organizationId: r.organizationId?.toString(),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/reviews
 * Authenticated: Add a new testimonial
 */
reviewRouter.post(
  "/",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { patientName, rating, comment, tag, isPublished } = req.body;

      if (!patientName || typeof patientName !== "string" || !patientName.trim()) {
        res.status(400).json({ success: false, error: "Patient name is required", code: "INVALID_INPUT" });
        return;
      }

      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        res.status(400).json({ success: false, error: "Rating must be between 1 and 5", code: "INVALID_RATING" });
        return;
      }

      if (!comment || typeof comment !== "string" || !comment.trim()) {
        res.status(400).json({ success: false, error: "Comment/Testimonial text is required", code: "INVALID_INPUT" });
        return;
      }

      let organizationId = null;
      let doctorId = null;

      if (user.role === UserRole.SUPERADMIN) {
        organizationId = req.body.organizationId || null;
        doctorId = req.body.doctorId || null;
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        organizationId = user.organizationId;
        if (typeof req.body.doctorId === "string" && req.body.doctorId.trim()) {
          const targetDoc = await Doctor.findOne({
            _id: req.body.doctorId.trim(),
            organizationId: user.organizationId,
          }).select("_id");
          if (!targetDoc) {
            res.status(403).json({ success: false, error: "Doctor does not belong to your hospital", code: "FORBIDDEN" });
            return;
          }
          doctorId = targetDoc._id;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) {
        doctorId = user.doctorProfileId;
        if (user.organizationId) organizationId = user.organizationId;
      }

      // Check review count constraint (Max 9 allowed)
      const countFilter: Record<string, unknown> = {};
      if (doctorId) {
        countFilter.doctorId = doctorId;
      } else if (organizationId) {
        countFilter.organizationId = organizationId;
        countFilter.$or = [{ doctorId: null }, { doctorId: { $exists: false } }];
      }
      const currentCount = await Review.countDocuments(countFilter);
      if (currentCount >= 9) {
        res.status(400).json({
          success: false,
          error: "Maximum 9 patient reviews allowed. Please delete or edit an existing review before adding more.",
          code: "MAX_REVIEWS_REACHED",
        });
        return;
      }

      const review = await Review.create({
        organizationId,
        doctorId,
        patientName: patientName.trim(),
        rating: Math.min(5, Math.max(1, numRating)),
        comment: comment.trim(),
        tag: tag?.trim() || "Verified Patient",
        isVerified: true,
        isPublished: isPublished !== false,
      });

      await logAuditEvent({
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        action: "TESTIMONIAL_CREATED",
        entityType: "Review",
        entityId: review._id.toString(),
        organizationId: organizationId ? organizationId.toString() : null,
        doctorId: doctorId ? doctorId.toString() : null,
        details: { patientName: review.patientName, rating: review.rating },
      });

      res.status(201).json({
        success: true,
        message: "Testimonial created successfully",
        data: {
          review: {
            id: review._id.toString(),
            patientName: review.patientName,
            rating: review.rating,
            comment: review.comment,
            tag: review.tag,
            isVerified: review.isVerified,
            isPublished: review.isPublished,
            createdAt: review.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/reviews/:id
 * Authenticated: Edit an existing testimonial with strict tenant validation
 */
reviewRouter.put(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const review = await Review.findById(req.params.id);

      if (!review) {
        res.status(404).json({ success: false, error: "Testimonial not found", code: "NOT_FOUND" });
        return;
      }

      // Check tenant ownership
      if (user.role === UserRole.SUPERADMIN) {
        // Allowed
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || review.organizationId?.toString() !== user.organizationId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden: Not your hospital's testimonial", code: "FORBIDDEN" });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId || review.doctorId?.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden: You can only edit your own testimonials", code: "FORBIDDEN" });
          return;
        }
      } else {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const { patientName, rating, comment, tag, isPublished } = req.body;
      if (patientName !== undefined) review.patientName = String(patientName).trim();
      if (rating !== undefined) {
        const numRating = Number(rating);
        if (!isNaN(numRating) && numRating >= 1 && numRating <= 5) {
          review.rating = numRating;
        }
      }
      if (comment !== undefined) review.comment = String(comment).trim();
      if (tag !== undefined) review.tag = String(tag).trim();
      if (isPublished !== undefined) review.isPublished = Boolean(isPublished);

      await review.save();

      res.status(200).json({
        success: true,
        message: "Testimonial updated successfully",
        data: {
          review: {
            id: review._id.toString(),
            patientName: review.patientName,
            rating: review.rating,
            comment: review.comment,
            tag: review.tag,
            isVerified: review.isVerified,
            isPublished: review.isPublished,
            updatedAt: review.updatedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/reviews/:id
 * Authenticated: Permanently delete a testimonial
 */
reviewRouter.delete(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const review = await Review.findById(req.params.id);

      if (!review) {
        res.status(404).json({ success: false, error: "Testimonial not found", code: "NOT_FOUND" });
        return;
      }

      // Check tenant ownership
      if (user.role === UserRole.SUPERADMIN) {
        // Allowed
      } else if (user.role === UserRole.HOSPITAL_ADMIN) {
        if (!user.organizationId || review.organizationId?.toString() !== user.organizationId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden", code: "FORBIDDEN" });
          return;
        }
      } else if (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) {
        if (!user.doctorProfileId || review.doctorId?.toString() !== user.doctorProfileId.toString()) {
          res.status(403).json({ success: false, error: "Forbidden", code: "FORBIDDEN" });
          return;
        }
      } else {
        res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      // Check min 3 reviews constraint (cannot delete below 3)
      const deleteCountFilter: Record<string, unknown> = {};
      if (review.doctorId) {
        deleteCountFilter.doctorId = review.doctorId;
      } else if (review.organizationId) {
        deleteCountFilter.organizationId = review.organizationId;
        deleteCountFilter.$or = [{ doctorId: null }, { doctorId: { $exists: false } }];
      }
      const currentReviewCount = await Review.countDocuments(deleteCountFilter);
      if (currentReviewCount <= 3) {
        res.status(400).json({
          success: false,
          error: "Minimum 3 patient reviews are required on your website. You cannot delete below 3 reviews.",
          code: "MIN_REVIEWS_REQUIRED",
        });
        return;
      }

      await Review.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: "Testimonial deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/reviews/regenerate-ai
 * Authenticated: Generate fresh AI testimonials for doctor or hospital
 */
reviewRouter.post(
  "/regenerate-ai",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const mode = req.body.mode === "APPEND" ? "APPEND" : "REPLACE";

      let type: "DOCTOR" | "HOSPITAL" = "DOCTOR";
      let doctorName: string | undefined;
      let specialization: string | undefined;
      let degree: string | undefined;
      let clinicName: string | undefined;
      let hospitalName: string | undefined;
      let city: string | undefined;

      let organizationId: any = null;
      let doctorId: any = null;

      if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
        organizationId = user.organizationId;
        if (typeof req.body.doctorId === "string" && req.body.doctorId.trim()) {
          const doc = await Doctor.findOne({
            _id: req.body.doctorId.trim(),
            organizationId: user.organizationId,
          });
          if (!doc) {
            res.status(403).json({ success: false, error: "Doctor does not belong to your hospital", code: "FORBIDDEN" });
            return;
          }
          type = "DOCTOR";
          doctorId = doc._id;
          doctorName = doc.doctorName;
          specialization = doc.specialization;
          degree = doc.degree;
          clinicName = doc.clinicName;
          city = doc.address?.city;
          const org = await Organization.findById(user.organizationId);
          if (org) {
            hospitalName = org.name;
            city = org.address?.city || city;
          }
        } else {
          type = "HOSPITAL";
          const org = await Organization.findById(user.organizationId);
          if (org) {
            hospitalName = org.name;
            city = org.address?.city;
          }
        }
      } else if (user.doctorProfileId) {
        type = "DOCTOR";
        doctorId = user.doctorProfileId;
        const doc = await Doctor.findById(user.doctorProfileId);
        if (doc) {
          doctorName = doc.doctorName;
          specialization = doc.specialization;
          degree = doc.degree;
          clinicName = doc.clinicName;
          city = doc.address?.city;
          if (doc.organizationId) {
            organizationId = doc.organizationId;
            const org = await Organization.findById(doc.organizationId);
            if (org) {
              hospitalName = org.name;
              city = org.address?.city || city;
            }
          }
        }
      } else if (user.role === UserRole.SUPERADMIN) {
        if (req.body.organizationId) {
          type = "HOSPITAL";
          organizationId = req.body.organizationId;
          const org = await Organization.findById(req.body.organizationId);
          if (org) {
            hospitalName = org.name;
            city = org.address?.city;
          }
        } else if (req.body.doctorId) {
          type = "DOCTOR";
          doctorId = req.body.doctorId;
          const doc = await Doctor.findById(req.body.doctorId);
          if (doc) {
            doctorName = doc.doctorName;
            specialization = doc.specialization;
            degree = doc.degree;
            clinicName = doc.clinicName;
            city = doc.address?.city;
          }
        }
      }

      const scopeQuery: Record<string, any> = {};
      if (doctorId) {
        scopeQuery.doctorId = doctorId;
      } else if (organizationId) {
        scopeQuery.organizationId = organizationId;
        scopeQuery.$or = [{ doctorId: null }, { doctorId: { $exists: false } }];
      }

      const generated = await geminiService.generatePatientTestimonials({
        type,
        doctorName,
        specialization,
        degree,
        clinicName,
        hospitalName,
        city,
      });

      if (mode === "APPEND") {
        const existingCount = Object.keys(scopeQuery).length > 0
          ? await Review.countDocuments(scopeQuery)
          : 0;
        if (existingCount + generated.length > 9) {
          res.status(400).json({
            success: false,
            error: `Adding 4 AI reviews would exceed the maximum limit of 9 patient reviews (currently ${existingCount}/9).`,
            code: "MAX_REVIEWS_REACHED",
          });
          return;
        }
      } else if (Object.keys(scopeQuery).length > 0) {
        await Review.deleteMany(scopeQuery);
      }

      const toInsert = generated.map((g) => ({
        organizationId,
        doctorId,
        patientName: g.patientName,
        rating: g.rating,
        comment: g.comment,
        tag: g.tag,
        isVerified: true,
        isPublished: true,
      }));

      const createdReviews = await Review.insertMany(toInsert);

      res.status(200).json({
        success: true,
        message: "Testimonials regenerated successfully with AI",
        data: {
          reviews: createdReviews.map((r) => ({
            id: r._id.toString(),
            patientName: r.patientName,
            rating: r.rating,
            comment: r.comment,
            tag: r.tag,
            isVerified: r.isVerified,
            isPublished: r.isPublished,
            createdAt: r.createdAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
