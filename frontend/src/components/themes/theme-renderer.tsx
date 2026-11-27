import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import { HospitalClassicTheme } from "./hospital-classic-theme";
import { PublicChatbotWidget } from "@/components/chatbot/public-chatbot-widget";
import { WebsiteThemeModeProvider } from "./shared/website-mode-context";
import { resolveThemePalette } from "@/lib/theme-palettes";

interface ThemeRendererProps {
  data: EffectiveWebsiteData;
  initialThemeMode?: "light" | "dark";
}

export function ThemeRenderer({ data, initialThemeMode = "dark" }: ThemeRendererProps) {
  const theme = resolveThemePalette(data.selectedTheme);

  return (
    <WebsiteThemeModeProvider defaultMode={initialThemeMode}>
      {/* SSR inline style to immediately set the scrollbar color to active theme, eliminating blue flash on refresh */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html.public-website {
              --theme-primary: ${theme.primary};
              --theme-primary-hover: ${theme.primaryHover};
              --theme-primary-light: ${theme.primaryLight};
              --scrollbar-thumb: ${initialThemeMode === "light" ? theme.primary : theme.primaryLight};
              --scrollbar-thumb-hover: ${initialThemeMode === "light" ? theme.primaryHover : theme.primary};
            }
            .dark html.public-website, html.dark.public-website {
              --scrollbar-thumb: ${theme.primaryLight};
              --scrollbar-thumb-hover: ${theme.primary};
            }
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{document.documentElement.classList.add("public-website");var c=document.cookie.match(/doczeno_site_theme_mode=([^;]+)/);var m=c?c[1]:localStorage.getItem("doczeno_site_theme_mode");if(m==="light"){document.documentElement.classList.remove("dark");document.documentElement.setAttribute("data-theme","light");document.documentElement.style.setProperty("--scrollbar-thumb","${theme.primary}");document.documentElement.style.setProperty("--scrollbar-thumb-hover","${theme.primaryHover}");}else{document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.setProperty("--scrollbar-thumb","${theme.primaryLight}");document.documentElement.style.setProperty("--scrollbar-thumb-hover","${theme.primary}");}document.documentElement.style.setProperty("--theme-primary","${theme.primary}");document.documentElement.style.setProperty("--theme-primary-hover","${theme.primaryHover}");document.documentElement.style.setProperty("--theme-primary-light","${theme.primaryLight}");}catch(e){}})()`,
        }}
      />
      <HospitalClassicTheme data={data} />
      {data.isWebsiteChatbotEnabled !== false && (
        <PublicChatbotWidget
          slug={data.slug}
          doctorSlug={data.isHospitalChild ? data.slug : undefined}
          parentHospitalSlug={data.isHospitalChild ? data.hospitalSlug : undefined}
          displayName={data.doctorName ? `Dr. ${data.doctorName}` : data.organizationName}
          websiteType={data.websiteType}
          selectedTheme={data.selectedTheme}
        />
      )}
    </WebsiteThemeModeProvider>
  );
}
