"use client";

import * as React from "react";

export type WebsiteThemeMode = "light" | "dark";

interface WebsiteThemeModeContextType {
  mode: WebsiteThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (mode: WebsiteThemeMode) => void;
}

const WebsiteThemeModeContext = React.createContext<WebsiteThemeModeContextType | null>(null);

export function useWebsiteThemeMode(): WebsiteThemeModeContextType {
  const ctx = React.useContext(WebsiteThemeModeContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    return {
      mode: "light",
      isDark: false,
      toggleMode: () => {},
      setMode: () => {},
    };
  }
  return ctx;
}

interface WebsiteThemeModeProviderProps {
  children: React.ReactNode;
  defaultMode?: WebsiteThemeMode;
}

export function WebsiteThemeModeProvider({
  children,
  defaultMode = "light",
}: WebsiteThemeModeProviderProps) {
  // Always initialize with defaultMode so SSR HTML matches initial client hydration
  const [mode, setModeState] = React.useState<WebsiteThemeMode>(defaultMode);

  // Apply class to documentElement immediately
  const applyThemeMode = React.useCallback((m: WebsiteThemeMode) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("doczeno_site_theme_mode", m);
      document.cookie = `doczeno_site_theme_mode=${m}; path=/; max-age=31536000; SameSite=Lax`;
      if (m === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      // Ignore
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.add("public-website");
    try {
      const stored = window.localStorage.getItem("doczeno_site_theme_mode") as WebsiteThemeMode | null;
      if (stored === "dark" || stored === "light") {
        if (stored !== mode) {
          setModeState(stored);
        }
        applyThemeMode(stored);
      } else {
        applyThemeMode(mode);
      }
    } catch {
      applyThemeMode(mode);
    }
    return () => {
      document.documentElement.classList.remove("public-website");
    };
  }, [applyThemeMode, mode]);

  const setMode = React.useCallback((newMode: WebsiteThemeMode) => {
    setModeState(newMode);
    applyThemeMode(newMode);
  }, [applyThemeMode]);

  const toggleMode = React.useCallback(() => {
    setModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeMode(next);
      return next;
    });
  }, [applyThemeMode]);

  const isDark = mode === "dark";

  return (
    <WebsiteThemeModeContext.Provider value={{ mode, isDark, toggleMode, setMode }}>
      <div
        className={isDark ? "dark" : "light"}
        data-website-theme-mode={mode}
        suppressHydrationWarning
      >
        {children}
      </div>
    </WebsiteThemeModeContext.Provider>
  );
}
