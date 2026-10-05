import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { MediaService, MediaCategory } from "@/services/media.service";
import { requireAuthenticatedUser } from "@/middleware/auth";

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB absolute ceiling
  },
});

// Request presigned upload authorization token
mediaRouter.post(
  "/upload-url",
  requireAuthenticatedUser,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, fileName, fileSize, mimeType } = req.body;
      const ownerId =
        req.user?.doctorProfileId ||
        req.user?.organizationId ||
        req.user?.userId ||
        "anonymous";

      const authData = MediaService.generateUploadAuthorization({
        category: category as MediaCategory,
        fileName: fileName || "upload.jpg",
        fileSize: Number(fileSize) || 0,
        mimeType: mimeType || "image/jpeg",
        ownerId,
      });

      res.status(200).json({ success: true, data: authData });
    } catch (error) {
      next(error);
    }
  }
);

// Secure direct file upload with binary signature verification
mediaRouter.post(
  "/upload",
  requireAuthenticatedUser,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded", code: "FILE_MISSING" });
        return;
      }

      const category = (req.body.category || "DOCTOR_PHOTO") as MediaCategory;
      const ownerType = (req.body.ownerType || "DOCTOR") as "DOCTOR" | "ORGANIZATION";
      const ownerId =
        req.body.ownerId ||
        req.user?.doctorProfileId ||
        req.user?.organizationId ||
        req.user?.userId;

      if (!ownerId) {
        res.status(400).json({ success: false, error: "Owner ID is required", code: "OWNER_REQUIRED" });
        return;
      }

      const asset = await MediaService.uploadMediaBuffer({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        category,
        ownerId,
        ownerType,
        altText: req.body.altText,
      });

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: { asset },
      });
    } catch (error) {
      next(error);
    }
  }
);

// List media assets for owner
mediaRouter.get(
  "/owner/:ownerId",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mediaList = await MediaService.listOwnerMedia(req.params.ownerId as string);
      res.status(200).json({ success: true, data: { media: mediaList } });
    } catch (error) {
      next(error);
    }
  }
);

// Delete media asset with tenant authorization
mediaRouter.delete(
  "/:id",
  requireAuthenticatedUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await MediaService.deleteMedia(req.params.id as string, req.user!);
      res.status(200).json({ success: true, message: "Media deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);
