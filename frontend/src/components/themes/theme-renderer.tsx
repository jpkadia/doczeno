import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import { ClinicalEditorialTheme } from "./clinical-editorial-theme";
import { ModernMinimalTheme } from "./modern-minimal-theme";
import { VitalCompactTheme } from "./vital-compact-theme";

interface ThemeRendererProps {
  data: EffectiveWebsiteData;
}

export function ThemeRenderer({ data }: ThemeRendererProps) {
  const theme = data.selectedTheme?.toLowerCase();

  switch (theme) {
    case "modern-minimal":
      return <ModernMinimalTheme data={data} />;
    case "vital-compact":
      return <VitalCompactTheme data={data} />;
    case "clinical-editorial":
    default:
      return <ClinicalEditorialTheme data={data} />;
  }
}
