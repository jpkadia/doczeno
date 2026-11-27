"use client";

import * as React from "react";
import { Star, Quote, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { TestimonialItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useWebsiteThemeMode } from "./website-mode-context";
import { resolveThemePalette } from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

interface TestimonialsSectionProps {
  testimonials?: TestimonialItem[];
  isDoctor?: boolean;
  practiceName: string;
  specialization?: string;
  themeVariant?: "clinical" | "minimal" | "compact";
  isGradient?: boolean;
  selectedTheme?: string;
  badgeText?: string;
  title?: string;
  subtitle?: string;
}

export function TestimonialsSection({
  testimonials = [],
  isDoctor = false,
  practiceName,
  specialization,
  themeVariant = "clinical",
  isGradient = true,
  selectedTheme,
  badgeText,
  title,
  subtitle,
}: TestimonialsSectionProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = resolveThemePalette(selectedTheme);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [activeSlide, setActiveSlide] = React.useState(0);

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    const itemWidth = clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    const newIndex = Math.round(scrollLeft / (itemWidth || 1));
    setActiveSlide(Math.min(testimonials.length - 1, Math.max(0, newIndex)));
  }, [testimonials.length]);

  React.useEffect(() => {
    const el = scrollRef.current;
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
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    const scrollAmount = direction === "left" ? -itemWidth : itemWidth;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    el.scrollTo({ left: index * itemWidth, behavior: "smooth" });
  };

  // If testimonials are empty, don't show an empty broken section
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  const sectionPadding =
    themeVariant === "compact"
      ? "py-8 sm:py-12"
      : themeVariant === "minimal"
      ? "py-12 sm:py-16"
      : "py-16 sm:py-20";

  return (
    <section
      id="reviews"
      className={cn(
        "scroll-mt-16 transition-colors duration-200",
        isGradient ? "border-y" : "",
        isDark ? "text-slate-100" : "text-slate-800",
        sectionPadding
      )}
      style={
        isGradient
          ? {
              borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
              background: isDark
                ? `radial-gradient(circle at 85% 30%, ${theme.softBgDark} 0%, transparent 60%),
                   radial-gradient(circle at 15% 70%, ${theme.softBgDark} 0%, transparent 55%),
                   linear-gradient(135deg, ${theme.heroMeshDarkFrom} 0%, ${theme.sectionAltBgDark} 50%, ${theme.pageBgDark} 100%)`
                : `radial-gradient(circle at 85% 30%, ${theme.softBgLight} 0%, transparent 60%),
                   radial-gradient(circle at 15% 70%, ${theme.softBgLight} 0%, transparent 55%),
                   linear-gradient(135deg, ${theme.sectionAltBgLight} 0%, ${theme.noticeBgLight} 50%, ${theme.pageBgLight} 100%)`,
            }
          : {
              backgroundColor: isDark ? theme.pageBgDark : theme.pageBgLight,
            }
      }
    >
      <span id="testimonials" className="sr-only" />
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 space-y-2.5">
          <Badge
            variant="outline"
            className={cn(
              "px-3 py-1 text-xs font-semibold uppercase tracking-wider mx-auto inline-flex items-center gap-1.5 border shadow-2xs transition-colors duration-200",
              isDark
                ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
            )}
          >
            <Quote className="h-3 w-3 text-[var(--theme-primary)]" />
            {badgeText || "Patient Reviews"}
          </Badge>
          <h2
            className={cn(
              "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
              isDark ? "text-white" : "text-slate-900"
            )}
          >
            {title || "What Our Patients Say"}
          </h2>
          <p className={cn("text-xs sm:text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
            {subtitle?.trim()
              ? subtitle
              : isDoctor
              ? `Real experiences and feedback from patients treated under the dedicated medical care of ${
                  practiceName.startsWith("Dr.") ? practiceName : `Dr. ${practiceName}`
                }${specialization ? ` (${specialization})` : ""}.`
              : `Heartfelt stories and reviews from patients and families who received care at ${practiceName}.`}
          </p>
        </div>

        {/* Slider Controls Header */}
        {testimonials.length > 1 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground font-medium">
              Verified Feedback ({testimonials.length} reviews)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Previous patient reviews"
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
                aria-label="Next patient reviews"
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

        {/* Testimonials Slider Track (Single row, slide left/right) */}
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-5 sm:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]",
            testimonials.length < 3 && "justify-center"
          )}
        >
          {testimonials.map((t, idx) => {
            const cardWidthClass =
              testimonials.length === 1
                ? "w-full max-w-lg"
                : testimonials.length === 2
                ? "w-full sm:w-[calc(50%-12px)] max-w-md"
                : "w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]";

            return (
              <Card
                key={t.id || idx}
                className={cn(
                  "shrink-0 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden group snap-start border rounded-2xl cursor-default",
                  cardWidthClass,
                  "hover:-translate-y-1.5 hover:shadow-xl",
                  isDark
                    ? "hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/15 text-slate-100"
                    : "hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/12 text-slate-800",
                  themeVariant === "compact" ? "p-4" : "p-5 sm:p-6"
                )}
                style={{
                  backgroundColor: isDark ? "var(--theme-card-bg, #0f172a)" : "#ffffff",
                  borderColor: isDark ? "var(--theme-card-border, #334155)" : "var(--theme-card-border, rgba(5, 150, 105, 0.25))",
                }}
              >
              <CardContent className="p-0 space-y-4">
                {/* Top Rating & Tag */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4",
                          i < (t.rating || 5)
                            ? "fill-amber-400 text-amber-400"
                            : isDark
                            ? "text-slate-700"
                            : "text-slate-200"
                        )}
                      />
                    ))}
                    <span className={cn("text-xs font-bold ml-1", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t.rating ? `${t.rating}.0` : "5.0"}
                    </span>
                  </div>

                  {t.tag && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium max-w-[130px] truncate",
                        isDark ? "bg-black/30 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                      )}
                    >
                      {t.tag}
                    </Badge>
                  )}
                </div>

                {/* Comment Quote */}
                <p className={cn("text-xs sm:text-sm leading-relaxed italic line-clamp-4", isDark ? "text-slate-300" : "text-slate-700")}>
                  &quot;{t.comment}&quot;
                </p>
              </CardContent>

              {/* Author Info */}
              <div
                className={cn(
                  "pt-4 mt-4 border-t flex items-center justify-between gap-3"
                )}
                style={{
                  borderColor: isDark ? "var(--theme-card-border, #334155)" : "#f1f5f9",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-xs bg-[var(--theme-primary)] text-white"
                  >
                    {t.patientName?.charAt(0)?.toUpperCase() || "P"}
                  </div>
                  <div>
                    <h3 className={cn("text-xs sm:text-sm font-semibold leading-tight", isDark ? "text-white" : "text-slate-900")}>
                      {t.patientName}
                    </h3>
                    <span className="text-[11px] text-emerald-500 font-medium inline-flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Verified Patient
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

        {/* Pagination Dots */}
        {testimonials.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to review ${i + 1}`}
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
    </section>
  );
}
