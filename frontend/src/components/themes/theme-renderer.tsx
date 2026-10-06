import * as React from "react";
import { EffectiveWebsiteData } from "@/types";
import { ClinicalEditorialTheme } from "./clinical-editorial-theme";
import { ModernMinimalTheme } from "./modern-minimal-theme";
import { VitalCompactTheme } from "./vital-compact-theme";
import { PublicChatbotWidget } from "@/components/chatbot/public-chatbot-widget";

interface ThemeRendererProps {
  data: EffectiveWebsiteData;
}

export function ThemeRenderer({ data }: ThemeRendererProps) {
  const theme = data.selectedTheme?.toLowerCase();

  const renderSelectedTheme = () => {
    switch (theme) {
      case "modern-minimal":
        return <ModernMinimalTheme data={data} />;
      case "vital-compact":
        return <VitalCompactTheme data={data} />;
      case "clinical-editorial":
      default:
        return <ClinicalEditorialTheme data={data} />;
    }
  };

  return (
    <>
      {renderSelectedTheme()}
      <PublicChatbotWidget
        slug={data.slug}
        doctorSlug={data.isHospitalChild ? data.slug : undefined}
        parentHospitalSlug={data.isHospitalChild ? data.hospitalSlug : undefined}
        displayName={data.doctorName ? `Dr. ${data.doctorName}` : data.organizationName}
        websiteType={data.websiteType}
      />
    </>
  );
}
