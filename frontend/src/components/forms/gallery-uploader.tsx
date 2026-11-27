"use client";

import * as React from "react";
import { X, ArrowLeft, ArrowRight, Loader2, Image as ImageIcon, ZoomIn, Trash2, Crop as CropIcon } from "lucide-react";
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

interface GalleryUploaderProps {
  label?: string;
  value: MediaAsset[];
  onChange: (assets: MediaAsset[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  error?: string;
  disabled?: boolean;
}

export function GalleryUploader({
  label = "Facility & Clinic Gallery Photos",
  value = [],
  onChange,
  maxFiles = 6,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB per image
  error,
  disabled,
}: GalleryUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // 4:3 Aspect Ratio Cropper State (Task 5 & Sequential Multiple Crop)
  const cropQueueRef = React.useRef<File[]>([]);
  const cropTotalCountRef = React.useRef<number>(1);
  const cropCurrentIndexRef = React.useRef<number>(1);
  const valueRef = React.useRef<MediaAsset[]>(value);
  valueRef.current = value;

  const [currentCropFile, setCurrentCropFile] = React.useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = React.useState(false);
  const [recropIndex, setRecropIndex] = React.useState<number | null>(null);

  // Delete Confirmation State
  const [deleteTargetIndex, setDeleteTargetIndex] = React.useState<number | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Clean label for lightbox header (strips '(Max 6)', '(Optional)', etc.)
  const cleanLabel = React.useMemo(() => {
    return (label || "Facility & Clinic Gallery Photos").replace(/\s*\([^)]*\)/g, "").trim();
  }, [label]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    const availableSlots = maxFiles - value.length;
    if (availableSlots <= 0) {
      setUploadError(`Maximum limit of ${maxFiles} photos already reached`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);
    if (files.length > availableSlots) {
      setUploadError(`Only ${availableSlots} more photo(s) can be added (max ${maxFiles})`);
    }

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
    const validFiles: File[] = [];
    for (const file of filesToUpload) {
      if (file.size > maxSizeBytes) {
        setUploadError(`File ${file.name} exceeds maximum size of ${maxMb} MB`);
        continue;
      }
      const ext = file.name.includes(".")
        ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
        : "";
      const isImageMime = file.type.startsWith("image/");
      if (!allowedExtensions.includes(ext) && !isImageMime) {
        setUploadError(`Unsupported format (${ext || file.type}). Allowed: JPG, JPEG, PNG, WebP, HEIC.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Initialize 4:3 crop sequence with queue tracking
    setRecropIndex(null);
    cropTotalCountRef.current = validFiles.length;
    cropCurrentIndexRef.current = 1;
    cropQueueRef.current = validFiles.slice(1);

    const first = validFiles[0];
    if (!first) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setCurrentCropFile(first);
    setCropImageSrc(URL.createObjectURL(first));
    setIsCropDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropConfirmed = async (croppedFile: File, _previewUrl: string) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", croppedFile);
      formData.append("category", "GALLERY");
      formData.append("ownerType", "ORGANIZATION");

      const res = await apiClient.post<{ asset?: MediaAsset; data?: { asset: MediaAsset } }>("/media/upload", formData);
      const uploadedAsset = res.asset || res.data?.asset;

      if (uploadedAsset) {
        if (recropIndex !== null && recropIndex >= 0 && recropIndex < valueRef.current.length) {
          const updated = [...valueRef.current];
          updated[recropIndex] = uploadedAsset;
          valueRef.current = updated;
          onChange(updated);
          toast.success("Photo re-cropped to 4:3 successfully.");
          setRecropIndex(null);
        } else {
          const updated = [...valueRef.current, uploadedAsset];
          valueRef.current = updated;
          onChange(updated);
          toast.success(`Photo ${cropCurrentIndexRef.current} of ${cropTotalCountRef.current} cropped & uploaded.`);
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gallery upload failed");
      toast.error("Failed to upload cropped photo. Continuing with remaining photos...");
    } finally {
      setIsUploading(false);
      // Process next in queue if any
      if (cropQueueRef.current.length > 0) {
        const next = cropQueueRef.current.shift()!;
        cropCurrentIndexRef.current += 1;
        setCurrentCropFile(next);
        setCropImageSrc(URL.createObjectURL(next));
        setIsCropDialogOpen(true);
      } else {
        setIsCropDialogOpen(false);
        setCurrentCropFile(null);
        setCropImageSrc(null);
        setRecropIndex(null);
        if (cropTotalCountRef.current > 1) {
          toast.success(`All ${cropTotalCountRef.current} gallery photos cropped and added successfully!`);
        }
      }
    }
  };

  const handleCropCancelled = () => {
    if (cropQueueRef.current.length > 0) {
      const next = cropQueueRef.current.shift()!;
      cropCurrentIndexRef.current += 1;
      setCurrentCropFile(next);
      setCropImageSrc(URL.createObjectURL(next));
      setIsCropDialogOpen(true);
      toast.info(`Skipped photo. Now cropping photo ${cropCurrentIndexRef.current} of ${cropTotalCountRef.current}...`);
    } else {
      setIsCropDialogOpen(false);
      setCurrentCropFile(null);
      setCropImageSrc(null);
      setRecropIndex(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetIndex === null || deleteTargetIndex < 0 || deleteTargetIndex >= value.length) return;
    const assetToRemove = value[deleteTargetIndex];
    try {
      setIsDeleting(true);
      if (assetToRemove?.publicId || assetToRemove?.url) {
        await apiClient.post("/media/delete-asset", {
          publicId: assetToRemove.publicId || "",
          assetUrl: assetToRemove.url || "",
        });
      }
      const updated = [...value];
      updated.splice(deleteTargetIndex, 1);
      onChange(updated);
      setUploadError(null);
      toast.success("Gallery photo deleted successfully from storage and database.");
      setDeleteTargetIndex(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete gallery photo";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= value.length) return;

    const updated = [...value];
    const item = updated[index];
    const targetItem = updated[targetIndex];
    if (!item || !targetItem) return;

    updated[index] = targetItem;
    updated[targetIndex] = item;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs font-semibold text-primary">
          4:3 Crop • {value.length} / {maxFiles} images
        </span>
      </div>

      {/* Thumbnails Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {value.map((asset, index) => (
          <div
            key={asset.publicId || index}
            className="group relative rounded-lg border border-border bg-card overflow-hidden aspect-[4/3] shadow-xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={asset.altText || `Gallery image ${index + 1}`}
              className="h-full w-full object-cover"
            />

            {/* Hover Actions Bar */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white font-mono font-bold bg-black/40 px-1 rounded">
                  #{index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled || isUploading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecropIndex(index);
                      cropTotalCountRef.current = 1;
                      cropCurrentIndexRef.current = 1;
                      cropQueueRef.current = [];
                      setCropImageSrc(asset.url);
                      setIsCropDialogOpen(true);
                    }}
                    className="text-white hover:text-primary p-0.5 rounded transition-colors"
                    title="Re-crop photo (4:3)"
                  >
                    <CropIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || isDeleting}
                    onClick={() => setDeleteTargetIndex(index)}
                    className="text-white hover:text-red-400 p-0.5 rounded transition-colors"
                    title="Delete image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Center Clickable Area for Full-Size Popup */}
              <button
                type="button"
                onClick={() => {
                  setLightboxIndex(index);
                  setIsLightboxOpen(true);
                }}
                className="flex-1 flex flex-col items-center justify-center text-white/90 hover:text-white transition-transform hover:scale-110"
                title="Click to view full size (without clipping)"
              >
                <ZoomIn className="h-5 w-5 drop-shadow-sm" />
                <span className="text-[9px] font-medium mt-0.5">View Full</span>
              </button>

              {/* Reorder Buttons */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => handleMove(index, "left")}
                  className="text-white hover:text-primary disabled:opacity-30 p-0.5"
                  title="Move backward"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => handleMove(index, "right")}
                  className="text-white hover:text-primary disabled:opacity-30 p-0.5"
                  title="Move forward"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Upload Trigger Tile (if slots remaining) */}
        {value.length < maxFiles && (
          <div
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-3 text-center cursor-pointer aspect-[4/3] transition-colors hover:bg-card hover:border-primary/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.jpeg,.jpg,.png,.webp,.heic,.heif"
              className="hidden"
              disabled={disabled || isUploading}
              onChange={handleFilesSelect}
            />
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
                <span className="text-[11px] font-semibold text-foreground">Add Photo</span>
                <span className="text-[9px] text-muted-foreground">Max {maxMb} MB</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(error || uploadError) && (
        <p className="text-xs text-destructive font-medium">{error || uploadError}</p>
      )}

      {/* Full-Size Un-cropped Gallery Lightbox Modal */}
      <ImageLightboxDialog
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        images={value.map((a, i) => ({
          url: a.url,
          altText: a.altText || `Gallery image ${i + 1}`,
          title: value.length > 1 ? `${cleanLabel} (${i + 1} of ${value.length})` : cleanLabel,
        }))}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteTargetIndex !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTargetIndex(null);
          }
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
                  Delete Gallery Photo?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Confirm permanent deletion
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this photo? It will be removed from Cloudinary storage, the database, and your live website gallery.
            </p>

            {deleteTargetIndex !== null && value[deleteTargetIndex] && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="h-14 w-14 rounded-md overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={value[deleteTargetIndex].url}
                    alt={value[deleteTargetIndex].altText || `Photo #${deleteTargetIndex + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    Photo #{deleteTargetIndex + 1}
                  </p>
                  <p
                    className="text-[11px] text-slate-500 font-mono truncate max-w-[260px] mt-0.5"
                    title={value[deleteTargetIndex].publicId || "gallery-photo"}
                  >
                    {value[deleteTargetIndex].publicId?.split("/").pop() || "gallery-photo"}
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
              onClick={() => setDeleteTargetIndex(null)}
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

      {/* 4:3 Aspect Ratio Cropper Dialog (Task 5 & Queue Sequential Cropping) */}
      <ImageCropperDialog
        open={isCropDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCropCancelled();
          } else {
            setIsCropDialogOpen(true);
          }
        }}
        imageSrc={cropImageSrc}
        title={
          cropTotalCountRef.current > 1
            ? `Crop Gallery Photo (4:3) — Photo ${cropCurrentIndexRef.current} of ${cropTotalCountRef.current}`
            : "Crop Gallery Photo (4:3)"
        }
        description="Position, zoom, and adjust your facility photo in the 4:3 landscape frame."
        aspect={4 / 3}
        fileName={currentCropFile?.name || "gallery-photo.jpg"}
        closeOnConfirm={false}
        onCropConfirmed={handleCropConfirmed}
        onCancel={handleCropCancelled}
      />
    </div>
  );
}
