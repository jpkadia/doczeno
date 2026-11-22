"use client";

import * as React from "react";
import { INDIA_STATES_AND_CITIES } from "@/constants/healthcare";
import { COUNTRIES } from "@/constants/countries";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StateCitySelectProps {
  countryValue?: string;
  stateValue?: string;
  cityValue?: string;
  onCountryChange?: (country: string) => void;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  countryError?: string;
  stateError?: string;
  cityError?: string;
  disabled?: boolean;
}

export function StateCitySelect({
  countryValue = "India",
  stateValue = "",
  cityValue = "",
  onCountryChange,
  onStateChange,
  onCityChange,
  countryError,
  stateError,
  cityError,
  disabled,
}: StateCitySelectProps) {
  const currentCountry = countryValue || "India";
  const isIndia = currentCountry.toLowerCase() === "india" || currentCountry.toLowerCase() === "in";

  const states = Object.keys(INDIA_STATES_AND_CITIES);
  const cities = isIndia && stateValue ? INDIA_STATES_AND_CITIES[stateValue] || [] : [];

  return (
    <div className="space-y-4">
      {/* Country Select (placed before State) */}
      <div className="space-y-1.5">
        <Label htmlFor="country-select" className="text-sm font-medium">
          Country <span className="text-destructive">*</span>
        </Label>
        <select
          id="country-select"
          disabled={disabled}
          value={currentCountry}
          onChange={(e) => {
            const nextCountry = e.target.value;
            onCountryChange?.(nextCountry);
            // Reset state and city when country changes
            onStateChange("");
            onCityChange("");
          }}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            countryError && "border-destructive ring-1 ring-destructive"
          )}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name} {c.nativeName ? `(${c.nativeName})` : ""}
            </option>
          ))}
        </select>
        {countryError && (
          <p className="text-xs text-destructive font-medium">{countryError}</p>
        )}
      </div>

      {/* State & City Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* State Field */}
        <div className="space-y-1.5">
          <Label htmlFor="state-select" className="text-sm font-medium">
            {isIndia ? "State" : "State / Province / Region"} <span className="text-destructive">*</span>
          </Label>
          {isIndia ? (
            <select
              id="state-select"
              disabled={disabled}
              value={stateValue || ""}
              onChange={(e) => {
                const nextState = e.target.value;
                onStateChange(nextState);
                onCityChange("");
              }}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                stateError && "border-destructive ring-1 ring-destructive"
              )}
            >
              <option value="">Select State</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="state-select"
              disabled={disabled}
              value={stateValue || ""}
              onChange={(e) => onStateChange(e.target.value)}
              placeholder="Enter state or province"
              className={cn(stateError && "border-destructive ring-1 ring-destructive")}
            />
          )}
          {stateError && (
            <p className="text-xs text-destructive font-medium">{stateError}</p>
          )}
        </div>

        {/* City Field */}
        <div className="space-y-1.5">
          <Label htmlFor="city-select" className="text-sm font-medium">
            City <span className="text-destructive">*</span>
          </Label>
          {isIndia ? (
            <select
              id="city-select"
              disabled={disabled || !stateValue}
              value={cityValue || ""}
              onChange={(e) => onCityChange(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                cityError && "border-destructive ring-1 ring-destructive"
              )}
            >
              <option value="">
                {stateValue ? "Select City" : "Select State First"}
              </option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="city-select"
              disabled={disabled}
              value={cityValue || ""}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="Enter city or town"
              className={cn(cityError && "border-destructive ring-1 ring-destructive")}
            />
          )}
          {cityError && (
            <p className="text-xs text-destructive font-medium">{cityError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
