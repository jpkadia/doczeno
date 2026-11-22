"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { useWebsiteThemeMode } from "./website-mode-context";
import { cn } from "@/lib/utils";

interface ThemeModeToggleProps {
  variant?: "header" | "floating";
  className?: string;
}

export function ThemeModeToggle({
  variant = "header",
  className,
}: ThemeModeToggleProps) {
  const { isDark, toggleMode } = useWebsiteThemeMode();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "floating") {
      return (
        <div className="fixed bottom-6 left-6 z-50 font-sans print:hidden">
          <div className="h-10 w-24 rounded-full border border-transparent" />
        </div>
      );
    }
    return <div className="inline-flex h-9 w-9 rounded-xl border border-transparent" />;
  }

  if (variant === "floating") {
    return (
      <div className="fixed bottom-6 left-6 z-50 font-sans print:hidden">
        <button
          type="button"
          onClick={toggleMode}
          suppressHydrationWarning
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={cn(
            "group flex items-center gap-2 px-3.5 py-2.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 select-none",
            isDark
              ? "bg-slate-900/90 hover:bg-slate-800 text-white border-slate-700/60 focus:ring-slate-400/40 shadow-slate-950/20"
              : "bg-white/95 hover:bg-white text-slate-700 border-slate-200 hover:text-slate-900 focus:ring-slate-300 shadow-slate-900/10",
            className
          )}
        >
          <div className="relative flex items-center justify-center">
            {isDark ? (
              <Sun className="h-4 w-4 text-white transition-transform group-hover:rotate-45 duration-300" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 group-hover:text-[var(--theme-primary)] transition-transform group-hover:-rotate-12 duration-300" />
            )}
          </div>
          <span className="text-xs font-medium tracking-tight">
            {isDark ? "Light" : "Dark"}
          </span>
        </button>
      </div>
    );
  }

  // Header variant
  return (
    <button
      type="button"
      onClick={toggleMode}
      suppressHydrationWarning
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "relative inline-flex items-center justify-center h-9 w-9 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 select-none",
        isDark
          ? "bg-slate-800/80 hover:bg-slate-700/80 text-white border-slate-700 focus:ring-slate-400/40"
          : "bg-white/90 hover:bg-white text-slate-700 border-slate-200/80 hover:text-slate-900 focus:ring-slate-300 shadow-2xs",
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-white transition-transform hover:rotate-45 duration-300" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 hover:text-[var(--theme-primary)] transition-transform hover:-rotate-12 duration-300" />
      )}
    </button>
  );
}
