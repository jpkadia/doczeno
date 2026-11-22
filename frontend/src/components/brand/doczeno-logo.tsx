import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DoczenoLogoProps {
  /**
   * "icon" for the standalone 1:1 D-Cross-Pulse mark
   * "full" for icon + "DOCZENO" wordmark stacked
   * "horizontal" for icon + "Doczeno" side-by-side
   */
  variant?: "icon" | "full" | "horizontal";
  /**
   * Size presets
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtitle?: string;
  href?: string;
  /**
   * If true, white background card/plate around icon
   */
  withBackground?: boolean;
}

const SIZE_MAP = {
  xs: { icon: "h-6 w-6", text: "text-base", subtext: "text-[9px]" },
  sm: { icon: "h-8 w-8", text: "text-lg", subtext: "text-[10px]" },
  md: { icon: "h-10 w-10", text: "text-xl", subtext: "text-xs" },
  lg: { icon: "h-14 w-14", text: "text-2xl", subtext: "text-sm" },
  xl: { icon: "h-20 w-20", text: "text-3xl", subtext: "text-base" },
};

/**
 * High-Resolution 2D Graphic PNG Brand Mark for Doczeno
 * Renders the exact uploaded 1:1 mark with Letter 'D', Medical Cross, and ECG Heartbeat Wave.
 */
export function DoczenoIconMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt="Doczeno Logo Mark"
      className={cn("shrink-0 select-none object-contain", className || "h-10 w-10")}
      loading="eager"
    />
  );
}

export function DoczenoLogo({
  variant = "horizontal",
  size = "md",
  className,
  iconClassName,
  textClassName,
  subtitle,
  href,
  withBackground = false,
}: DoczenoLogoProps) {
  const currentSize = SIZE_MAP[size] || SIZE_MAP.md;

  const content = (
    <div
      className={cn(
        "inline-flex items-center",
        variant === "full" ? "flex-col text-center" : "flex-row gap-3",
        className
      )}
    >
      {variant === "full" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="Doczeno Healthcare Platform"
          className={cn("select-none object-contain", currentSize.icon, iconClassName)}
          loading="eager"
        />
      ) : (
        <>
          <div
            className={cn(
              "relative flex items-center justify-center shrink-0",
              withBackground && "bg-white rounded-xl shadow-xs border border-slate-100 p-1.5"
            )}
          >
            <DoczenoIconMark className={cn(currentSize.icon, iconClassName)} />
          </div>

          {variant !== "icon" && (
            <div className="flex flex-col leading-none">
              <span
                className={cn(
                  "font-extrabold tracking-tight text-[#0F2E4A] dark:text-white",
                  currentSize.text,
                  textClassName
                )}
              >
                Doczeno
              </span>
              {subtitle && (
                <span
                  className={cn(
                    "text-slate-500 font-medium tracking-wide uppercase mt-1",
                    currentSize.subtext
                  )}
                >
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
