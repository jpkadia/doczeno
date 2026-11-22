"use client";

import * as React from "react";
import { Search, AlertCircle } from "lucide-react";
import {
  COUNTRIES,
  CountryInfo,
  parsePhoneNumber,
  validatePhoneForCountry,
  formatToInternational,
} from "@/constants/countries";
import { cn } from "@/lib/utils";

export interface CountryFlagProps {
  country: CountryInfo;
  className?: string;
}

/**
 * Renders a crisp SVG/image country flag.
 * Windows OS does not have Unicode emoji flags in Segoe UI Emoji,
 * so we use vector SVG flags stored locally in /flags/[code].svg,
 * with CDN fallback to ensure 100% cross-platform flag rendering.
 */
export function CountryFlag({ country, className }: CountryFlagProps) {
  const [srcIndex, setSrcIndex] = React.useState(0);
  const codeLower = country.code.toLowerCase();

  React.useEffect(() => {
    setSrcIndex(0);
  }, [country.code]);

  const sources = React.useMemo(
    () => [
      `/flags/${codeLower}.svg`,
      `https://flagcdn.com/w40/${codeLower}.png`,
    ],
    [codeLower]
  );

  if (srcIndex >= sources.length) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center font-bold text-[9px] tracking-wider rounded-[2px] px-1 py-0.5 bg-muted border border-border text-foreground shrink-0 leading-none select-none",
          className
        )}
      >
        {country.code}
      </span>
    );
  }

  const currentSrc = sources[srcIndex];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={`${country.name} flag`}
      className={cn(
        "w-5 h-3.5 object-cover rounded-[2px] border border-slate-300/80 dark:border-slate-700/80 shadow-2xs shrink-0 inline-block align-middle",
        className
      )}
      loading="lazy"
      onError={() => setSrcIndex((prev) => prev + 1)}
    />
  );
}

export interface PhoneInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  showErrorText?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  hint?: string;
  label?: string;
}

export function PhoneInput({
  id,
  name,
  value = "",
  onChange,
  onBlur,
  error,
  showErrorText = false,
  disabled = false,
  required = false,
  className,
  placeholder,
  hint,
}: PhoneInputProps) {
  // Parse incoming value into country and national number
  const parsed = React.useMemo(() => parsePhoneNumber(value), [value]);

  const [selectedCountry, setSelectedCountry] = React.useState<CountryInfo>(parsed.country);
  const [nationalNumber, setNationalNumber] = React.useState<string>(parsed.nationalNumber);
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [internalError, setInternalError] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const numberInputRef = React.useRef<HTMLInputElement>(null);

  // Sync internal state if external value changes (e.g. form reset or pre-population)
  React.useEffect(() => {
    const updated = parsePhoneNumber(value);
    setSelectedCountry(updated.country);
    setNationalNumber(updated.nationalNumber);
  }, [value]);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter countries by search query
  const filteredCountries = React.useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const query = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.nativeName && c.nativeName.toLowerCase().includes(query)) ||
        c.dialCode.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle country selection
  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");

    // Validate existing number with new country rules
    if (nationalNumber) {
      const validation = validatePhoneForCountry(country, nationalNumber);
      setInternalError(validation.isValid ? null : validation.error || null);
      const formatted = formatToInternational(country, nationalNumber);
      onChange?.(formatted);
    } else {
      setInternalError(null);
    }

    numberInputRef.current?.focus();
  };

  // Handle number input change
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/[^0-9]/g, "");
    const maxDigits = selectedCountry.maxDigits;
    const limitedDigits = cleanDigits.slice(0, maxDigits);

    setNationalNumber(limitedDigits);

    if (limitedDigits) {
      const validation = validatePhoneForCountry(selectedCountry, limitedDigits);
      setInternalError(validation.isValid ? null : validation.error || null);
      const formatted = formatToInternational(selectedCountry, limitedDigits);
      onChange?.(formatted);
    } else {
      setInternalError(null);
      onChange?.("");
    }
  };

  const handleInputBlur = () => {
    if (nationalNumber) {
      const validation = validatePhoneForCountry(selectedCountry, nationalNumber);
      setInternalError(validation.isValid ? null : validation.error || null);
    }
    onBlur?.();
  };

  const activeError = error || internalError;

  return (
    <div className={cn("space-y-1 w-full relative", className)} ref={containerRef}>
      {/* Input container matching intl-tel-input style */}
      <div
        className={cn(
          "relative flex items-center rounded-xl border transition-all h-10 shadow-2xs",
          "focus-within:ring-2 focus-within:ring-[var(--theme-primary,var(--ring))]/30 focus-within:border-[var(--theme-primary,var(--input))]",
          activeError ? "border-destructive focus-within:ring-destructive/20 focus-within:border-destructive" : "border-[var(--theme-card-border,var(--input))]",
          disabled && "opacity-50 pointer-events-none bg-muted"
        )}
        style={{
          backgroundColor: "var(--theme-inner-card-bg, inherit)",
          borderColor: "var(--theme-card-border, inherit)",
        }}
      >
        {/* Country Selector Trigger [ Flag +91 ▾ ] */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 border-r border-[var(--theme-card-border,var(--input))] bg-muted/20 hover:bg-muted/50 transition-colors rounded-l-xl text-sm shrink-0 select-none h-full",
            "focus:outline-hidden",
            isOpen && "bg-muted/60"
          )}
          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <CountryFlag country={selectedCountry} />
          <span className="font-medium text-xs text-foreground tracking-tight">
            {selectedCountry.dialCode}
          </span>
          <span className="text-[10px] text-muted-foreground/80 leading-none select-none">▾</span>
        </button>

        {/* National Number Input */}
        <input
          ref={numberInputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={nationalNumber}
          onChange={handleNumberChange}
          onBlur={handleInputBlur}
          placeholder={placeholder || "Enter mobile number"}
          disabled={disabled}
          required={required}
          className={cn(
            "flex-1 w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-hidden",
            "disabled:cursor-not-allowed"
          )}
        />
      </div>

      {/* Dropdown Popover matching screenshot exactly */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 sm:w-96 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-foreground shadow-xl animate-in fade-in-0 zoom-in-95 overflow-hidden">
          {/* Top Search Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country name or code..."
                className="w-full bg-white dark:bg-slate-900 rounded-md pl-8 pr-3 py-1.5 text-xs outline-hidden border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Scrollable Countries List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 text-xs">
            {filteredCountries.map((country) => {
              const isSelected = country.code === selectedCountry.code;
              const displayName = country.nativeName
                ? `${country.name} (${country.nativeName})`
                : country.name;

              return (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelectCountry(country)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-left transition-colors cursor-pointer",
                    "hover:bg-slate-100 dark:hover:bg-slate-800/80",
                    isSelected && "bg-slate-50 dark:bg-slate-800 font-medium text-primary"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <CountryFlag country={country} />
                    <span className="truncate text-slate-800 dark:text-slate-200">{displayName}</span>
                  </div>

                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0 pl-2">
                    {country.dialCode}
                  </span>
                </button>
              );
            })}

            {filteredCountries.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No matching country found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error or validation message (only rendered if showErrorText is true, since FormField renders error by default) */}
      {showErrorText && activeError ? (
        <p className="text-xs text-destructive font-medium flex items-center gap-1 pt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{activeError}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground pt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}
