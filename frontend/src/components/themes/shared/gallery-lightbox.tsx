"use client";

import * as React from "react";
import { MediaAsset } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Maximize2, X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryLightboxProps {
  photos?: MediaAsset[];
  aspectRatio?: "video" | "square" | "wide";
  gridCols?: string;
  className?: string;
}

export function GalleryLightbox({
  photos = [],
  aspectRatio = "video",
  gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  className,
}: GalleryLightboxProps) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "wide"
      ? "aspect-[16/9]"
      : "aspect-[4/3]";

  return (
    <>
      <div className={cn("grid gap-4", gridCols, className)}>
        {photos.map((photo, index) => (
          <div
            key={index}
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-muted cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50",
              aspectClass
            )}
          >
            {photo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt={photo.altText || `Facility photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-3">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>{photo.caption || `View Photo ${index + 1}`}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
          <DialogContent className="max-w-4xl p-1 bg-black/95 border-neutral-800 text-white overflow-hidden">
            <div className="relative flex flex-col items-center justify-center min-h-[50vh]">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Prev Button */}
              {selectedIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev !== null ? prev - 1 : null))}
                  className="absolute left-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-neutral-800"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Image Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[selectedIndex]?.url}
                alt={photos[selectedIndex]?.altText || "Facility preview"}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded"
              />

              {/* Next Button */}
              {selectedIndex < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev !== null ? prev + 1 : null))}
                  className="absolute right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-neutral-800"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}

              {/* Caption Footer */}
              <div className="p-3 text-center text-xs text-neutral-400">
                Photo {selectedIndex + 1} of {photos.length}
                {photos[selectedIndex]?.caption && ` — ${photos[selectedIndex]?.caption}`}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
