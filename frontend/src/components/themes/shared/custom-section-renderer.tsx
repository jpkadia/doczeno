"use client";

import * as React from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { CustomSectionConfig } from "@/constants/website-sections";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "./scroll-reveal";
import { useWebsiteThemeMode } from "./website-mode-context";
import { ThemePalette } from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

interface CustomSectionRendererProps {
  config: CustomSectionConfig;
  sectionClassName: string;
  sectionStyle: React.CSSProperties;
  theme: ThemePalette;
}

export function CustomSectionRenderer({
  config,
  sectionClassName,
  sectionStyle,
  theme,
}: CustomSectionRendererProps) {
  const { isDark } = useWebsiteThemeMode();

  if (!config || !config.enabled || !config.title?.trim()) {
    return null;
  }

  const cardCount = config.cards?.length || 0;
  const cardColClass =
    cardCount === 1
      ? "w-full max-w-md flex"
      : cardCount === 2
      ? "w-full sm:w-[calc(50%-12px)] max-w-md flex"
      : cardCount === 3
      ? "w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm flex"
      : "w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] max-w-sm flex";

  return (
    <section
      id="custom-section"
      className={cn(sectionClassName)}
      style={sectionStyle}
    >
      <div className="max-w-7xl mx-auto">
        <ScrollReveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-14" duration={600}>
          {config.badge?.trim() && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-3 py-1 mb-3 border shadow-2xs transition-colors duration-200",
                isDark
                  ? "bg-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/30 text-[var(--theme-primary-light)] border-[var(--theme-primary)]/30"
                  : "bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 text-[var(--theme-primary)] border-[var(--theme-primary)]/25"
              )}
            >
              {config.badge.trim()}
            </Badge>
          )}
          <h2 className={cn("text-3xl sm:text-4xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            {config.title.trim()}
          </h2>
          <div className="flex items-center justify-center gap-3 my-4">
            <span className="w-16 h-[2px] bg-[var(--theme-primary)]/40" />
            <Sparkles className="h-5 w-5 text-[var(--theme-primary)]" />
            <span className="w-16 h-[2px] bg-[var(--theme-primary)]/40" />
          </div>
          {config.subtitle?.trim() && (
            <p className={cn("text-xs sm:text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
              {config.subtitle.trim()}
            </p>
          )}
        </ScrollReveal>

        {/* Layout 1: Feature Cards Grid */}
        {config.layout === "cards" && Array.isArray(config.cards) && config.cards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-5 sm:gap-6">
            {config.cards.map((card, idx) => (
              <ScrollReveal key={idx} delay={idx * 60} duration={550} className={cardColClass}>
                <div
                  className={cn(
                    "w-full p-5 sm:p-6 rounded-2xl border transition-all duration-300 ease-out flex flex-col justify-start group cursor-default",
                    "hover:-translate-y-1.5 hover:shadow-xl",
                    isDark
                      ? "text-slate-100 hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/15"
                      : "text-slate-800 hover:border-[var(--theme-primary)] hover:shadow-[var(--theme-primary)]/12"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                  }}
                >
                  <h3 className={cn("text-base sm:text-lg font-bold leading-snug transition-colors duration-200 group-hover:text-[var(--theme-primary)]", isDark ? "text-white" : "text-slate-900")}>
                    {card.title}
                  </h3>
                  <p className={cn("text-xs sm:text-sm mt-2 leading-relaxed break-words", isDark ? "text-slate-300" : "text-slate-600")}>
                    {card.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}

        {/* Layout 2: Focused Heading & Editorial Paragraph */}
        {config.layout === "narrative" && config.paragraph?.trim() && (
          <ScrollReveal className="max-w-4xl mx-auto" duration={600}>
            <div
              className="p-6 sm:p-10 rounded-3xl border shadow-xl transition-colors"
              style={{
                backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
              }}
            >
              <p className={cn("text-sm sm:text-base leading-relaxed whitespace-pre-line break-words", isDark ? "text-slate-200" : "text-slate-700")}>
                {config.paragraph.trim()}
              </p>
            </div>
          </ScrollReveal>
        )}

        {/* Layout 3: Structured Key Points / Milestones */}
        {config.layout === "highlights" && Array.isArray(config.points) && config.points.length > 0 && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {config.points.map((pt, idx) => (
              <ScrollReveal key={idx} delay={idx * 50} duration={550}>
                <div
                  className={cn(
                    "h-full p-5 rounded-2xl border flex items-start gap-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                  }}
                >
                  <div className="h-8 w-8 rounded-xl bg-[var(--theme-primary)]/12 text-[var(--theme-primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className={cn("text-sm sm:text-base font-bold leading-snug", isDark ? "text-white" : "text-slate-900")}>
                      {pt.heading}
                    </h3>
                    <p className={cn("text-xs sm:text-sm leading-relaxed break-words", isDark ? "text-slate-300" : "text-slate-600")}>
                      {pt.detail}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
