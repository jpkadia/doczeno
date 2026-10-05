"use client";

import * as React from "react";
import { PREBUILT_THEMES, WebsiteThemePreview } from "@/constants/healthcare";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Monitor, Smartphone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  value: string;
  onChange: (themeId: string) => void;
  error?: string;
  disabled?: boolean;
}

export function ThemeSelector({
  value,
  onChange,
  error,
  disabled,
}: ThemeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Select Website Design Architecture
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose from three distinct structural layouts engineered specifically for clinical workflows.
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          3 Distinct Structures
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PREBUILT_THEMES.map((theme: WebsiteThemePreview) => {
          const isSelected = value === theme.id;

          return (
            <div
              key={theme.id}
              onClick={() => !disabled && onChange(theme.id)}
              className={cn(
                "group relative rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between bg-card hover:shadow-md",
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border hover:border-border/80",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Header with Title and Selection Indicator */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {theme.name}
                    </h4>
                    <span className="text-[11px] font-medium text-primary">
                      {theme.tagline}
                    </span>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-border group-hover:border-primary/50 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {theme.layoutDescription}
                </p>
              </div>

              {/* Visual Layout Mockups (Desktop & Mobile Representations) */}
              <div className="mt-4 pt-3 border-t border-border/80 space-y-3">
                {/* Desktop Representation */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <Monitor className="h-3 w-3" />
                    Desktop Structure
                  </div>
                  <div className="rounded-md border border-border bg-background p-2 text-[11px] text-foreground/80 font-mono shadow-2xs">
                    {theme.id === "clinical-editorial" && (
                      <div className="flex gap-2">
                        <div className="w-1/3 bg-primary/15 rounded p-1 text-[9px] text-center font-bold">
                          Portrait & Credentials
                        </div>
                        <div className="w-2/3 space-y-1">
                          <div className="h-3 bg-muted rounded" />
                          <div className="h-2 w-3/4 bg-muted/60 rounded" />
                          <div className="h-2 w-1/2 bg-muted/40 rounded" />
                        </div>
                      </div>
                    )}
                    {theme.id === "modern-minimal" && (
                      <div className="space-y-1.5">
                        <div className="h-4 bg-primary/15 rounded text-[9px] text-center font-bold flex items-center justify-center">
                          Full-Width Hero + Slot Booking Bar
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="h-3 bg-muted rounded" />
                          <div className="h-3 bg-muted rounded" />
                          <div className="h-3 bg-muted rounded" />
                        </div>
                      </div>
                    )}
                    {theme.id === "vital-compact" && (
                      <div className="space-y-1">
                        <div className="h-2.5 bg-red-500/20 text-red-600 rounded text-[8px] font-bold px-1">
                          Emergency Hotline Strip
                        </div>
                        <div className="flex gap-1">
                          <div className="w-2/3 h-5 bg-primary/10 rounded text-[8px] p-0.5">
                            Tabs: Cardiology | Neuro
                          </div>
                          <div className="w-1/3 h-5 bg-muted rounded text-[8px] p-0.5">
                            Hours Widget
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Representation */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <Smartphone className="h-3 w-3" />
                    Mobile Structure
                  </div>
                  <div className="rounded-md border border-border bg-background p-2 text-[10px] text-muted-foreground">
                    <p className="line-clamp-2 text-[11px]">{theme.mobileLayout}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
