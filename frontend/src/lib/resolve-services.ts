import { EffectiveWebsiteData, ServiceItem } from "@/types";

/**
 * Resolves services uniformly across all 4 themes without trimming or distortion.
 */
export function resolveWebsiteServices(data: EffectiveWebsiteData): ServiceItem[] {
  if (data.services && data.services.length > 0) {
    return data.services;
  }
  if (data.departmentsDetailed && data.departmentsDetailed.length > 0) {
    return data.departmentsDetailed.map((d) => ({
      title: d.name,
      description: d.description || `Specialized clinical care, consultations, and medical interventions in ${d.name}.`,
    }));
  }
  if (data.departments && data.departments.length > 0) {
    return data.departments.map((d) => ({
      title: d,
      description: `Dedicated department care and specialized interventions in ${d}.`,
    }));
  }
  if (data.specialization) {
    return [
      { title: data.specialization, description: `Specialist diagnostic assessment and personalized medical care for ${data.specialization.toLowerCase()} conditions.` },
      { title: "Comprehensive Diagnostics", description: "Advanced clinical screening, laboratory evaluations, and targeted health assessments." },
      { title: "Clinical Consultations", description: "Evidence-based clinical protocols tailored to acute and chronic conditions." },
      { title: "Targeted Therapeutic Regimens", description: "Periodic monitoring, health reviews, and post-consultation recovery guidance." },
      { title: "Preventive Health Checkups", description: "Early detection checkups, wellness counseling, and preventive health guidance." },
      { title: "Post-Treatment Follow-up", description: "Urgent clinical triage and medical evaluation during active clinic hours." },
    ];
  }
  return [
    { title: "General Clinical Care", description: "Comprehensive health assessment and primary medical consultation." },
    { title: "Diagnostic Services", description: "In-depth diagnostic review and laboratory evaluation." },
    { title: "Follow-up Guidance", description: "Routine health monitoring and ongoing recovery care." },
    { title: "Preventive Care", description: "Early detection checkups and preventive health guidance." },
  ];
}
