"use client";

import * as React from "react";
import { Building2, Search, X, MapPin, Stethoscope, AlertCircle, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EligibleHospital {
  _id: string;
  name: string;
  slug: string;
  type: string;
  address?: {
    city?: string;
    state?: string;
  };
  specialties?: string[];
  logo?: {
    url?: string;
  };
  workingHours?: string;
  weeklyOff?: string;
}

interface HospitalSearchSelectProps {
  value: string;
  onChange: (organizationId: string, hospital?: EligibleHospital) => void;
  hospitals: EligibleHospital[];
  isLoading?: boolean;
  error?: string;
  disabled?: boolean;
  locked?: boolean;
}

export function HospitalSearchSelect({
  value,
  onChange,
  hospitals = [],
  isLoading = false,
  error,
  disabled = false,
  locked = false,
}: HospitalSearchSelectProps) {
  const [query, setQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);

  const selectedHospital = React.useMemo(() => {
    return hospitals.find((h) => h._id === value);
  }, [hospitals, value]);

  // Notify parent on mount if a default hospital is pre-selected
  React.useEffect(() => {
    if (value && selectedHospital) {
      onChange(value, selectedHospital);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedHospital?._id]);

  const filteredHospitals = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return hospitals.filter((h) => {
      const matchName = h.name.toLowerCase().includes(q);
      const matchCity = h.address?.city?.toLowerCase().includes(q);
      const matchState = h.address?.state?.toLowerCase().includes(q);
      const matchSlug = h.slug?.toLowerCase().includes(q);
      return matchName || matchCity || matchState || matchSlug;
    });
  }, [hospitals, query]);

  const handleSelectHospital = (h: EligibleHospital) => {
    onChange(h._id, h);
    setIsSearching(false);
    setQuery("");
  };

  const handleChangeHospital = () => {
    if (locked || disabled) return;
    onChange("", undefined);
    setIsSearching(true);
    setQuery("");
  };

  // State A: Hospital is selected and we are NOT in search mode
  if (selectedHospital && !isSearching) {
    const specialtiesCount = Array.isArray(selectedHospital.specialties)
      ? selectedHospital.specialties.length
      : 0;

    return (
      <div className="space-y-2">
        <div
          className={cn(
            "rounded-lg border bg-card p-4 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
            error && "border-destructive ring-1 ring-destructive"
          )}
        >
          <div className="flex items-start gap-3">
            {selectedHospital.logo?.url ? (
              <div className="h-12 w-12 rounded-lg border border-border/80 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedHospital.logo.url}
                  alt={selectedHospital.name}
                  className="h-full w-full object-contain rounded"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-foreground text-sm sm:text-base">
                  {selectedHospital.name}
                </h4>
                <Badge variant="outline" className="text-[11px] font-normal">
                  {selectedHospital.type === "HOSPITAL" ? "Multi-Specialty Hospital" : "Clinic"}
                </Badge>
                {locked && (
                  <Badge variant="secondary" className="text-[11px] gap-1 font-medium bg-muted">
                    <Lock className="h-3 w-3" />
                    Assigned Organization
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {(selectedHospital.address?.city || selectedHospital.address?.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {selectedHospital.address?.city}
                    {selectedHospital.address?.state ? `, ${selectedHospital.address.state}` : ""}
                  </span>
                )}

                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {specialtiesCount > 0
                    ? `${specialtiesCount} Available Department${specialtiesCount > 1 ? "s" : ""}`
                    : "All Specialties Available"}
                </span>
              </div>
            </div>
          </div>

          {!locked && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChangeHospital}
              className="text-xs h-8 shrink-0 self-start sm:self-auto"
            >
              Change Hospital
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }

  // State B: Search Combobox (User types hospital name or city to search)
  return (
    <div className="space-y-3">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by hospital name or city..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsSearching(true);
          }}
          disabled={disabled || isLoading}
          className={cn(
            "pl-9 pr-9 h-10 text-sm bg-background shadow-xs",
            error && "border-destructive ring-1 ring-destructive"
          )}
          autoFocus={isSearching}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Container: ONLY shown after user types/searches */}
      {query.trim().length > 0 && (
        <div className="rounded-lg border border-border bg-card p-2 shadow-sm space-y-2 max-h-72 overflow-y-auto animate-in fade-in-50">
          {filteredHospitals.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No Hospital Found Matching &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Please check the hospital name or city spelling. If the hospital is not yet registered on Doczeno, create it first via Hospital Onboarding.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Matching Hospitals ({filteredHospitals.length})
              </div>

              {filteredHospitals.map((h) => {
                const specCount = Array.isArray(h.specialties) ? h.specialties.length : 0;
                return (
                  <div
                    key={h._id}
                    onClick={() => handleSelectHospital(h)}
                    className="group flex items-center justify-between p-2.5 rounded-md border border-transparent hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {h.logo?.url ? (
                        <div className="h-10 w-10 rounded-md border border-border/70 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={h.logo.url}
                            alt={h.name}
                            className="h-full w-full object-contain rounded-xs"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted group-hover:bg-primary/10 text-foreground group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                          <Building2 className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {h.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.2 rounded">
                            {h.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                          <span>{h.address?.city || "Healthcare Facility"}</span>
                          <span>•</span>
                          <span className="text-primary font-medium">
                            {specCount > 0 ? `${specCount} Departments` : "Departments Configured"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs text-primary font-semibold group-hover:bg-primary group-hover:text-primary-foreground h-7 px-3 shrink-0"
                    >
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Helper text when search input is empty */}
      {!query && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Search from verified active healthcare organizations in Doczeno.</span>
          {hospitals.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery(" ")}
              className="text-primary hover:underline font-medium text-[11px]"
            >
              Browse all ({hospitals.length})
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
