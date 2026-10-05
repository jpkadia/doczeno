"use client";

import { useSearchParams } from "next/navigation";
import { HospitalDoctorForm } from "@/components/forms/hospital-doctor-form";

export function HospitalDoctorFormWrapper() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") || undefined;
  const locked = searchParams.get("locked") === "true";

  return (
    <HospitalDoctorForm
      defaultOrganizationId={orgId}
      lockOrganization={locked}
    />
  );
}
