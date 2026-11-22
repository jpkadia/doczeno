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
  className,
}: GalleryLightboxProps) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [activeSlide, setActiveSlide] = React.useState(0);

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "wide"
      ? "aspect-[16/9]"
      : "aspect-[4/3]";

  const updateScrollState = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    const itemWidth = clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    const newIndex = Math.round(scrollLeft / (itemWidth || 1));
    setActiveSlide(Math.min(photos.length - 1, Math.max(0, newIndex)));
  }, [photos.length]);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    const scrollAmount = direction === "left" ? -itemWidth : itemWidth;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    el.scrollTo({ left: index * itemWidth, behavior: "smooth" });
  };

  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn("relative group/slider", className)}>
        {/* Navigation Buttons (shown when multiple slides exist) */}
        {photos.length > 1 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground font-medium">
              Showing {photos.length} facility {photos.length === 1 ? "photo" : "photos"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Previous gallery photo"
                className={cn(
                  "p-2 rounded-full border transition-all duration-200 shadow-xs",
                  canScrollLeft
                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:bg-[var(--theme-primary)] hover:border-[var(--theme-primary)] hover:text-white cursor-pointer"
                    : "opacity-40 bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400 cursor-not-allowed"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Next gallery photo"
                className={cn(
                  "p-2 rounded-full border transition-all duration-200 shadow-xs",
                  canScrollRight
                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:bg-[var(--theme-primary)] hover:border-[var(--theme-primary)] hover:text-white cursor-pointer"
                    : "opacity-40 bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400 cursor-not-allowed"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Slider Track */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex gap-4 sm:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 pt-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]",
            photos.length < 3 && "justify-center"
          )}
        >
          {photos.map((photo, index) => {
            const photoWidthClass =
              photos.length === 1
                ? "w-full max-w-lg"
                : photos.length === 2
                ? "w-full sm:w-[calc(50%-12px)] max-w-md"
                : "w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]";

            return (
              <div
                key={index}
                className={cn(
                  "group relative shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:border-[var(--theme-primary)]/50 cursor-pointer snap-start",
                  photoWidthClass,
                  aspectClass
                )}
                style={{
                  backgroundColor: "var(--theme-inner-card-bg, #0f172a)",
                  borderColor: "var(--theme-card-border, #334155)",
                }}
                onClick={() => setSelectedIndex(index)}
              >
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.altText || `Facility photo ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-4">
                <span className="text-xs font-semibold text-white flex items-center gap-2 drop-shadow-md">
                  <Maximize2 className="h-4 w-4 text-[var(--theme-primary-light)]" />
                  <span>{photo.caption || `View Facility Photo ${index + 1}`}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

        {/* Pagination Dots */}
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeSlide === i
                    ? "w-6 bg-[var(--theme-primary)]"
                    : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                )}
              />
            ))}
          </div>
        )}
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
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80";
                }}
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
