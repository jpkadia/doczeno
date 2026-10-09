"use client";

import * as React from "react";
import { X, ArrowLeft, ArrowRight, Loader2, Image as ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
  maxSizeBytes = 3 * 1024 * 1024, // 3MB
  error,
  disabled,
}: GalleryUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      setIsUploading(true);
      const newAssets: MediaAsset[] = [];

      for (const file of filesToUpload) {
        if (file.size > maxSizeBytes) {
          throw new Error(`File ${file.name} exceeds maximum size of ${maxMb} MB`);
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "GALLERY");
        formData.append("ownerType", "ORGANIZATION");

        const res = await apiClient.post<{ asset?: MediaAsset; data?: { asset: MediaAsset } }>("/media/upload", formData);
        const uploadedAsset = res.asset || res.data?.asset;
        if (uploadedAsset) {
          newAssets.push(uploadedAsset);
        }
      }

      onChange([...value, ...newAssets]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gallery upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
    setUploadError(null);
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
          {value.length} / {maxFiles} images
        </span>
      </div>

      {/* Thumbnails Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {value.map((asset, index) => (
          <div
            key={asset.publicId || index}
            className="group relative rounded-lg border border-border bg-card overflow-hidden aspect-square shadow-xs"
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
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRemove(index)}
                  className="text-white hover:text-red-400 p-0.5 rounded transition-colors"
                  title="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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
              "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-3 text-center cursor-pointer aspect-square transition-colors hover:bg-card hover:border-primary/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpeg,.jpg,.png,.webp"
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
    </div>
  );
}
