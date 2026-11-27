"use client";

import * as React from "react";
import {
  Home,
  Stethoscope,
  Clock,
  Building2,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebsiteThemeMode } from "./website-mode-context";
import { resolveThemePalette, type ThemePalette } from "@/lib/theme-palettes";
import { WebsiteType } from "@/types";

interface MobileBottomNavProps {
  websiteType?: string;
  selectedTheme?: string;
  themePalette?: ThemePalette;
  hiddenSections?: string[];
}

interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  targetId: string;
  sectionIds: string[]; // Sections belonging to or following this milestone
}

export function MobileBottomNav({
  websiteType,
  selectedTheme,
  themePalette,
  hiddenSections = [],
}: MobileBottomNavProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = themePalette || resolveThemePalette(selectedTheme);
  const [activeTab, setActiveTab] = React.useState<string>("home");
  const isClickScrollingRef = React.useRef(false);
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isHospital = websiteType === WebsiteType.HOSPITAL_CLINIC;
  const hiddenKey = hiddenSections.join(",");

  // Visible fixed bottom tabs adapting cleanly when sections are toggled OFF
  const tabs: NavTabItem[] = React.useMemo(() => {
    const hidden = new Set(hiddenSections);
    const allTabs: NavTabItem[] = [
      {
        id: "home",
        label: "Home",
        icon: Home,
        targetId: "home",
        sectionIds: ["home", "hero", "about"],
      },
      ...(!hidden.has("services")
        ? [
            {
              id: isHospital ? "specialization" : "treatments",
              label: isHospital ? "Specialization" : "Treatments",
              icon: Stethoscope,
              targetId: isHospital ? "specializations" : "treatments",
              sectionIds: [
                "treatments",
                "specializations",
                "expertise",
                "services",
                "specialties",
                "doctors",
              ],
            },
          ]
        : []),
      ...(!hidden.has("timings")
        ? [
            {
              id: "timings",
              label: "Timings",
              icon: Clock,
              targetId: "timings",
              sectionIds: [
                "timings",
                "schedule",
                "availability",
                "timetable",
                "appointment-status",
                "faqs",
              ],
            },
          ]
        : []),
      ...(!hidden.has("facility")
        ? [
            {
              id: "facilities",
              label: "Facilities",
              icon: Building2,
              targetId: "facility",
              sectionIds: ["facility", "facilities", "clinic", "gallery"],
            },
          ]
        : []),
      {
        id: "contact",
        label: "Contact",
        icon: Phone,
        targetId: "contact",
        sectionIds: ["contact"],
      },
    ];
    return allTabs;
  }, [isHospital, hiddenKey]);

  // Handle Tab Click with smooth scrolling and instant active state
  const handleTabClick = (tab: NavTabItem) => {
    setActiveTab(tab.id);
    isClickScrollingRef.current = true;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    if (tab.id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      let targetEl: HTMLElement | null = null;
      // Try exact targetId first, then any matching alias sectionId
      targetEl = document.getElementById(tab.targetId);
      if (!targetEl) {
        for (const sid of tab.sectionIds) {
          const el = document.getElementById(sid);
          if (el) {
            targetEl = el;
            break;
          }
        }
      }

      if (targetEl) {
        // Offset for top sticky header
        const yOffset = -60;
        const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    }

    // Keep active tab locked during smooth scroll animation
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 850);
  };

  // Dynamic Scroll Spy: automatically detects active section as user scrolls
  React.useEffect(() => {
    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // 1. Top of page
      if (scrollY < 180) {
        setActiveTab("home");
        return;
      }

      // 2. Near bottom of page: always highlight Contact
      if (scrollY + windowHeight >= documentHeight - 120) {
        setActiveTab("contact");
        return;
      }

      // 3. Section Milestone detection (top to bottom)
      // Check each section's distance from the active viewport reading line (top 35% of screen)
      const scanLine = scrollY + windowHeight * 0.35;

      const milestones: { tabId: string; top: number }[] = [];

      for (const tab of tabs) {
        let el: HTMLElement | null = document.getElementById(tab.targetId);
        if (!el) {
          for (const sid of tab.sectionIds) {
            const candidate = document.getElementById(sid);
            if (candidate) {
              el = candidate;
              break;
            }
          }
        }

        if (el) {
          const rect = el.getBoundingClientRect();
          const elementAbsoluteTop = rect.top + scrollY;
          milestones.push({
            tabId: tab.id,
            top: elementAbsoluteTop,
          });
        }
      }

      // Sort milestones by document order
      milestones.sort((a, b) => a.top - b.top);

      // Find the lowest milestone that the scanLine has reached or passed
      let currentActiveId = "home";
      for (const m of milestones) {
        if (scanLine >= m.top - 50) {
          currentActiveId = m.tabId;
        }
      }

      setActiveTab(currentActiveId);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, [tabs]);

  return (
    <aside
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 min-[1033px]:hidden print:hidden select-none transition-all duration-200 border-t backdrop-blur-xl"
      style={{
        backgroundColor: isDark ? theme.headerBgDark : theme.headerBgLight,
        borderColor: isDark ? theme.cardBorderDark : "rgba(226, 232, 240, 0.85)",
        boxShadow: isDark
          ? `0 -4px 24px rgba(0, 0, 0, 0.65), 0 -1px 0 ${theme.cardBorderDark}`
          : "0 -4px 20px rgba(0, 0, 0, 0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
    >
      <nav
        className="grid items-center justify-items-center h-16 max-w-lg sm:max-w-xl mx-auto px-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab)}
              className="w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Pill Container (Material 3 / WhatsApp style: compact width, comfortable height) */}
              <div
                className={cn(
                  "w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 ease-out",
                  isActive ? "shadow-xs scale-100" : "bg-transparent scale-95"
                )}
                style={{
                  backgroundColor: isActive ? theme.primary : "transparent",
                }}
              >
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 transition-colors duration-200",
                    isActive
                      ? "text-white stroke-[2.3]"
                      : isDark
                      ? "text-slate-400 group-hover:text-slate-200 stroke-[1.8]"
                      : "text-slate-700 group-hover:text-slate-900 stroke-[2]"
                  )}
                />
              </div>

              {/* Tab Label */}
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 tracking-tight truncate max-w-[70px]",
                  isActive
                    ? "font-extrabold"
                    : isDark
                    ? "font-medium text-slate-400"
                    : "font-semibold text-slate-700"
                )}
                style={{
                  color: isActive ? (isDark ? theme.primaryLight : theme.primary) : undefined,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
