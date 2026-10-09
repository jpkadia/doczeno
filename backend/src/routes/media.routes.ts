import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
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
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "Please select an image file to upload", code: "FILE_MISSING" });
        return;
      }

      const category = (req.body.category || "DOCTOR_PHOTO") as MediaCategory;
      const ownerType = (req.body.ownerType || "DOCTOR") as "DOCTOR" | "ORGANIZATION";
      const ownerId =
        req.body.ownerId ||
        req.user?.doctorProfileId ||
        req.user?.organizationId ||
        req.user?.userId ||
        new mongoose.Types.ObjectId().toString();

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

// Serve locally stored media files securely
mediaRouter.get("/files/:category/:filename", (req: Request, res: Response) => {
  const categoryParam = String(req.params.category || "");
  const filenameParam = String(req.params.filename || "");
  const safeCategory = path.basename(categoryParam).toLowerCase();
  const safeFilename = path.basename(filenameParam);
  const filePath = path.resolve(process.cwd(), "uploads", safeCategory, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: "Media file not found", code: "NOT_FOUND" });
    return;
  }

  res.sendFile(filePath);
});

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
