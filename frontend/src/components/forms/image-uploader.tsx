"use client";

import * as React from "react";
import { UploadCloud, X, Loader2, CheckCircle2, Crop as CropIcon, ZoomIn, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ImageCropperDialog } from "./image-cropper-dialog";
import { ImageLightboxDialog } from "@/components/ui/image-lightbox-dialog";
import { toast } from "sonner";

interface ImageUploaderProps {
  label: string;
  category: "DOCTOR_PHOTO" | "CLINIC_LOGO" | "BUILDING_PHOTO";
  maxSizeBytes?: number;
  value?: MediaAsset;
  onChange: (asset?: MediaAsset) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  enableCrop?: boolean;
  replaceOnly?: boolean;
  cropAspect?: number;
  cropDescription?: string;
  aspect?: number;
}

export function ImageUploader({
  label,
  category,
  maxSizeBytes = category === "DOCTOR_PHOTO"
    ? 3 * 1024 * 1024
    : category === "BUILDING_PHOTO"
    ? 5 * 1024 * 1024
    : 2 * 1024 * 1024,
  value,
  onChange,
  error,
  disabled,
  required,
  enableCrop = true, // Strict cropping enabled: 1:1 for Doctor/Logo, 3:4 for Building Photo
  replaceOnly,
  cropAspect,
  cropDescription,
  aspect,
}: ImageUploaderProps) {
  const finalCropAspect = cropAspect || aspect || (category === "BUILDING_PHOTO" ? 3 / 4 : 1);
  const isReplaceOnly = replaceOnly !== undefined ? replaceOnly : category === "DOCTOR_PHOTO";
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);

  // Cropper Modal State
  const [isCropDialogOpen, setIsCropDialogOpen] = React.useState(false);
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = React.useState<string>("doctor-photo.jpg");

  // Lightbox Modal State
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Clean label for dialog headers (strips '(Optional)', '(Max 6)', etc.)
  const cleanLabel = React.useMemo(() => {
    return label.replace(/\s*\([^)]*\)/g, "").trim();
  }, [label]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side quick checks
    if (file.size > maxSizeBytes) {
      setUploadError(`File exceeds maximum size of ${maxMb} MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`Unsupported format (${ext}). Allowed: JPG, PNG, WebP.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setOriginalFileName(file.name);
    const objUrl = URL.createObjectURL(file);

    // If cropping is enabled (e.g. Doctor Profile Photo), open the square crop modal
    if (enableCrop) {
      setCropImageSrc(objUrl);
      setIsCropDialogOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Otherwise, direct upload (e.g. clinic logo)
    setLocalPreview(objUrl);
    uploadFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (fileToUpload: File) => {
    const oldPublicId = value?.publicId;
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("category", category);
      formData.append("ownerType", category === "DOCTOR_PHOTO" ? "DOCTOR" : "ORGANIZATION");

      const res = await apiClient.post<{ asset?: MediaAsset; data?: { asset: MediaAsset } }>(
        "/media/upload",
        formData
      );
      const uploadedAsset = res.asset || res.data?.asset;
      if (uploadedAsset) {
        // Purge replaced image asset from Cloudinary so orphans are not retained
        if (oldPublicId && oldPublicId !== uploadedAsset.publicId) {
          apiClient
            .post("/media/delete-asset", { publicId: oldPublicId, skipEntityUnset: true })
            .catch((err) => console.error("Cloudinary purge of old asset failed:", err));
        }
        onChange(uploadedAsset);
        toast.success(`${label} updated successfully!`);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropConfirmed = async (croppedFile: File, previewUrl: string) => {
    setLocalPreview(previewUrl);
    await uploadFile(croppedFile);
  };

  const handleCropCancelled = () => {
    if (cropImageSrc && !localPreview && !value?.url) {
      try {
        URL.revokeObjectURL(cropImageSrc);
      } catch {}
      setCropImageSrc(null);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      if (value?.publicId || value?.url) {
        await apiClient.post("/media/delete-asset", {
          publicId: value.publicId || "",
          assetUrl: value.url || "",
        });
      }
      if (localPreview) {
        try {
          URL.revokeObjectURL(localPreview);
        } catch {}
        setLocalPreview(null);
      }
      if (cropImageSrc) {
        try {
          URL.revokeObjectURL(cropImageSrc);
        } catch {}
        setCropImageSrc(null);
      }
      onChange(undefined);
      setUploadError(null);
      toast.success(`${cleanLabel || "Photo"} deleted successfully from storage and database.`);
      setIsDeleteDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete photo";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayImageSrc = localPreview || value?.url;

  return (
    <div className="space-y-1.5">
      {/* Hidden file input always available for initial upload & replacing */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpeg,.jpg,.png,.webp"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={handleFileSelect}
      />

      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <span className="text-[11px] text-muted-foreground">
          {enableCrop ? "1:1 Square Crop • " : ""}Max {maxMb} MB (.jpg, .png, .webp)
        </span>
      </div>

      {displayImageSrc ? (
        <div className="relative group rounded-lg border border-border bg-card p-2.5 flex items-center gap-3 shadow-xs">
          {/* Clickable Thumbnail Preview for Full-Size Popup */}
          <div
            onClick={() => setIsLightboxOpen(true)}
            className="group/thumb relative h-16 w-16 rounded-md overflow-hidden bg-muted border border-border cursor-pointer shrink-0 transition-transform hover:scale-105"
            title="Click to view full size (without clipping)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageSrc}
              alt={value?.altText || label}
              className="h-full w-full object-cover transition-opacity group-hover/thumb:opacity-85"
              onError={(e) => {
                if (localPreview && e.currentTarget.src !== localPreview) {
                  e.currentTarget.src = localPreview;
                }
              }}
            />

            {/* Hover Full-size Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
              <ZoomIn className="h-5 w-5 drop-shadow-sm" />
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground truncate">
                {value?.publicId?.split("/").pop() || originalFileName || "Selected Photo"}
              </p>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                <Eye className="h-3 w-3" />
                View Full
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
              {isUploading ? (
                <>
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  Uploading & Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  Verified & Ready
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Re-crop Button if crop is enabled */}
            {enableCrop && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => {
                  if (displayImageSrc) {
                    setCropImageSrc(displayImageSrc);
                    setIsCropDialogOpen(true);
                  }
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Adjust or re-crop photo"
              >
                <CropIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Crop</span>
              </Button>
            )}

            {/* Replace-Only mode (e.g. Doctor Profile Photo): Disallows deleting, shows prominent Change Photo button */}
            {isReplaceOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading || isDeleting}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary border-primary/40 transition-all gap-1.5 shadow-xs"
                title="Replace / Change photo"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Change Photo</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isUploading || isDeleting}
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                title="Delete photo"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-5 text-center cursor-pointer transition-colors hover:bg-card hover:border-primary/50",
            (error || uploadError) && "border-destructive/60 bg-destructive/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-1.5 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-medium">Validating & Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                <UploadCloud className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                Click or drag to upload {label.toLowerCase()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {enableCrop ? "Opens interactive square cropper • " : ""}Up to {maxMb} MB
              </span>
            </div>
          )}
        </div>
      )}

      {(error || uploadError) && (
        <p className="text-xs text-destructive font-medium">{error || uploadError}</p>
      )}

      {/* Interactive Cropper Dialog (1:1 for Doctor/Logo, 3:4 for Building Photo) */}
      <ImageCropperDialog
        open={isCropDialogOpen}
        onOpenChange={setIsCropDialogOpen}
        imageSrc={cropImageSrc}
        title={`Crop ${cleanLabel} (${finalCropAspect === 3 / 4 ? "3:4" : "1:1"})`}
        description={
          cropDescription ||
          (finalCropAspect === 3 / 4
            ? "Reposition, zoom, and adjust within the 3:4 vertical frame for the website homepage."
            : "Reposition, zoom, and adjust within the 1:1 square frame for optimal presentation.")
        }
        aspect={finalCropAspect}
        fileName={originalFileName}
        onCropConfirmed={handleCropConfirmed}
        onCancel={handleCropCancelled}
      />

      {/* Full-Size Un-cropped Lightbox Modal */}
      <ImageLightboxDialog
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        src={displayImageSrc}
        title={cleanLabel}
      />

      {/* Delete Confirmation Modal (Only rendered when not replace-only) */}
      {!isReplaceOnly && (
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!isDeleting) setIsDeleteDialogOpen(open);
          }}
        >
          <DialogContent className="sm:max-w-[420px] p-6 bg-white border-slate-200 shadow-xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Delete {cleanLabel || "Photo"}?
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Confirm permanent deletion
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete this photo? It will be removed from Cloudinary storage, the database, and your live website profile.
              </p>

              {displayImageSrc && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="h-14 w-14 rounded-md overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImageSrc}
                      alt={cleanLabel}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {cleanLabel}
                    </p>
                    <p
                      className="text-[11px] text-slate-500 font-mono truncate max-w-[260px] mt-0.5"
                      title={value?.publicId || originalFileName || "image-file"}
                    >
                      {value?.publicId?.split("/").pop() || originalFileName || "image-file"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Photo</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
