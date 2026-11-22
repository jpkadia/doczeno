"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { THEME_COLOR_LIST, ThemeColorId, resolveThemePalette } from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

interface ThemeColorSelectorProps {
  value?: string;
  onChange: (themeId: ThemeColorId) => void;
  disabled?: boolean;
  className?: string;
}

export function ThemeColorSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ThemeColorSelectorProps) {
  const currentPalette = resolveThemePalette(value || "blue");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Website Color Theme / Palette
        </label>
        <span className="text-xs font-medium text-slate-500">
          Selected: <strong className="text-[#1a76d1] font-bold">{currentPalette.label} ({currentPalette.name})</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {THEME_COLOR_LIST.map((theme) => {
          const isSelected = currentPalette.id === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(theme.id)}
              className={cn(
                "group relative p-3 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between gap-2.5",
                isSelected
                  ? "border-[#1a76d1] bg-blue-50/30 shadow-xs ring-2 ring-[#1a76d1]/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center justify-between">
                {/* Visual Swatch Pill */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded-full shadow-inner border border-black/10 flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: theme.swatchHex }}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                  </span>
                  <span
                    className="h-3 w-3 rounded-full opacity-60"
                    style={{ backgroundColor: theme.swatchSecondaryHex }}
                  />
                </div>

                {isSelected && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#1a76d1] text-white">
                    Active
                  </span>
                )}
              </div>

              <div>
                <p className={cn("text-xs font-bold leading-tight", isSelected ? "text-[#1560aa]" : "text-slate-900")}>
                  {theme.label}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight truncate">
                  {theme.name}
                </p>
              </div>

              {/* Gradient preview bar */}
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{
                  background: `linear-gradient(to right, ${theme.heroGradientFrom}, ${theme.heroGradientTo})`,
                }}
              />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">
        Changes primary accent colors, buttons, badges, highlights, and headers on your public live website.
      </p>
    </div>
  );
}
