"use client";

import * as React from "react";
import { INDIA_STATES_AND_CITIES } from "@/constants/healthcare";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StateCitySelectProps {
  stateValue?: string;
  cityValue?: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  stateError?: string;
  cityError?: string;
  disabled?: boolean;
}

export function StateCitySelect({
  stateValue,
  cityValue,
  onStateChange,
  onCityChange,
  stateError,
  cityError,
  disabled,
}: StateCitySelectProps) {
  const states = Object.keys(INDIA_STATES_AND_CITIES);
  const cities = stateValue ? INDIA_STATES_AND_CITIES[stateValue] || [] : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* State Dropdown */}
      <div className="space-y-1.5">
        <Label htmlFor="state-select" className="text-sm font-medium">
          State <span className="text-destructive">*</span>
        </Label>
        <select
          id="state-select"
          disabled={disabled}
          value={stateValue || ""}
          onChange={(e) => {
            const nextState = e.target.value;
            onStateChange(nextState);
            // Reset city when state changes
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
        {stateError && (
          <p className="text-xs text-destructive font-medium">{stateError}</p>
        )}
      </div>

      {/* Dependent City Dropdown */}
      <div className="space-y-1.5">
        <Label htmlFor="city-select" className="text-sm font-medium">
          City <span className="text-destructive">*</span>
        </Label>
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
        {cityError && (
          <p className="text-xs text-destructive font-medium">{cityError}</p>
        )}
      </div>
    </div>
  );
}
