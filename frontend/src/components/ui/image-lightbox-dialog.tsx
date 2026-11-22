"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  url: string;
  altText?: string;
  title?: string;
}

interface ImageLightboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Single image mode
  src?: string | null;
  alt?: string;
  title?: string;
  // Multi-image gallery mode
  images?: LightboxImage[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function ImageLightboxDialog({
  open,
  onOpenChange,
  src,
  alt = "Preview image",
  title,
  images,
  currentIndex = 0,
  onIndexChange,
}: ImageLightboxDialogProps) {
  const isGallery = Array.isArray(images) && images.length > 0;
  const currentImage = isGallery ? images[currentIndex] : null;

  const activeSrc = isGallery ? currentImage?.url : src;
  const activeAlt = isGallery ? currentImage?.altText || `Image ${currentIndex + 1}` : alt;
  const activeTitle = isGallery
    ? currentImage?.title || (images && images.length > 1 ? `Photo ${currentIndex + 1} of ${images.length}` : title || "")
    : title;

  const handlePrev = React.useCallback(() => {
    if (!isGallery || !images || !onIndexChange) return;
    const prev = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    onIndexChange(prev);
  }, [isGallery, images, currentIndex, onIndexChange]);

  const handleNext = React.useCallback(() => {
    if (!isGallery || !images || !onIndexChange) return;
    const next = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    onIndexChange(next);
  }, [isGallery, images, currentIndex, onIndexChange]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext]);

  if (!activeSrc) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 outline-none focus:outline-none pointer-events-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        >
          {/* Top Bar: Title & Close Button */}
          <div className="w-full max-w-5xl flex items-center justify-between z-10 pointer-events-auto">
            <div className="flex items-center gap-2 text-white/90">
              {activeTitle && (
                <span className="text-sm sm:text-base font-semibold drop-shadow-sm">
                  {activeTitle}
                </span>
              )}
            </div>

            <DialogPrimitive.Close className="rounded-full bg-white/10 hover:bg-white/25 text-white p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40">
              <X className="h-5 w-5" />
              <span className="sr-only">Close preview</span>
            </DialogPrimitive.Close>
          </div>

          {/* Central Image Area: Full-size without cut (object-contain) */}
          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2 sm:p-4 pointer-events-auto overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt={activeAlt}
              className="max-h-[80vh] max-w-[92vw] sm:max-w-full w-auto h-auto object-contain rounded-lg shadow-2xl select-none"
            />

            {/* Gallery Previous Arrow */}
            {isGallery && images && images.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/80 text-white p-2.5 backdrop-blur-sm transition-all shadow-lg hover:scale-110 focus:outline-none"
                title="Previous photo (Left arrow)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Gallery Next Arrow */}
            {isGallery && images && images.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/80 text-white p-2.5 backdrop-blur-sm transition-all shadow-lg hover:scale-110 focus:outline-none"
                title="Next photo (Right arrow)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Multi-image thumbnails or caption */}
          {isGallery && images && images.length > 1 ? (
            <div className="w-full max-w-xl flex items-center justify-center gap-2 overflow-x-auto py-2 z-10 pointer-events-auto">
              {images.map((img, idx) => (
                <button
                  key={img.url || idx}
                  type="button"
                  onClick={() => onIndexChange?.(idx)}
                  className={cn(
                    "relative h-12 w-12 rounded-md overflow-hidden border-2 transition-all shrink-0",
                    currentIndex === idx
                      ? "border-primary ring-2 ring-primary/40 scale-105 opacity-100"
                      : "border-transparent opacity-50 hover:opacity-80"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="h-4 pointer-events-none" />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
