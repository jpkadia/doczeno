"use client";

import * as React from "react";
import { UploadCloud, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  label: string;
  category: "DOCTOR_PHOTO" | "CLINIC_LOGO";
  maxSizeBytes?: number;
  value?: MediaAsset;
  onChange: (asset?: MediaAsset) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export function ImageUploader({
  label,
  category,
  maxSizeBytes = category === "DOCTOR_PHOTO" ? 3 * 1024 * 1024 : 2 * 1024 * 1024,
  value,
  onChange,
  error,
  disabled,
  required,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side quick checks
    if (file.size > maxSizeBytes) {
      setUploadError(`File exceeds maximum size of ${maxMb} MB`);
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`Unsupported format (${ext}). Allowed: JPG, PNG, WebP.`);
      return;
    }

    // Direct upload flow via backend
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("ownerType", category === "DOCTOR_PHOTO" ? "DOCTOR" : "ORGANIZATION");

      const res = await apiClient.post<{ asset?: MediaAsset; data?: { asset: MediaAsset } }>("/media/upload", formData);
      const uploadedAsset = res.asset || res.data?.asset;
      if (uploadedAsset) {
        onChange(uploadedAsset);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setUploadError(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <span className="text-[11px] text-muted-foreground">
          Max {maxMb} MB (.jpg, .png, .webp)
        </span>
      </div>

      {value?.url ? (
        <div className="relative group rounded-lg border border-border bg-card p-2 flex items-center gap-3">
          <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt={value.altText || label}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {value.publicId?.split("/").pop() || "Uploaded Asset"}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Verified & Uploaded
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleRemove}
            className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpeg,.jpg,.png,.webp"
            className="hidden"
            disabled={disabled || isUploading}
            onChange={handleFileSelect}
          />
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
                Up to {maxMb} MB in high resolution
              </span>
            </div>
          )}
        </div>
      )}

      {(error || uploadError) && (
        <p className="text-xs text-destructive font-medium">{error || uploadError}</p>
      )}
    </div>
  );
}
