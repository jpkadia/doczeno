"use client";

import * as React from "react";
import { MEDICAL_SPECIALIZATIONS } from "@/constants/healthcare";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check, ChevronsUpDown, CheckSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecialtiesMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function SpecialtiesMultiSelect({
  value = [],
  onChange,
  error,
  disabled,
  placeholder = "Select Hospital & Clinic Specialties (Multiple)",
}: SpecialtiesMultiSelectProps) {
  const [query, setQuery] = React.useState("");
  const [customInput, setCustomInput] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const customInputRef = React.useRef<HTMLInputElement>(null);

  const safeValue = Array.isArray(value) ? value : [];

  // Combine standard specializations with any custom-added ones
  const allKnownSpecialties = React.useMemo(() => {
    const customOnes = safeValue.filter(
      (s) => !(MEDICAL_SPECIALIZATIONS as readonly string[]).includes(s)
    );
    return Array.from(new Set([...customOnes, ...MEDICAL_SPECIALIZATIONS]));
  }, [safeValue]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allKnownSpecialties;
    return allKnownSpecialties.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allKnownSpecialties]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSpecialty = (specialty: string) => {
    if (safeValue.includes(specialty)) {
      onChange(safeValue.filter((s) => s !== specialty));
    } else {
      onChange([...safeValue, specialty]);
    }
  };

  const addCustomSpecialty = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = safeValue.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      onChange([...safeValue, trimmed]);
    }
    setCustomInput("");
    setQuery("");
  };

  const removeSpecialty = (specialty: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(safeValue.filter((s) => s !== specialty));
  };

  const selectAllFiltered = () => {
    const combined = Array.from(new Set([...safeValue, ...filtered]));
    onChange(combined);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className="space-y-2 w-full">
      {/* Trigger Box */}
      <div
        className={cn(
          "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm cursor-pointer transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive ring-1 ring-destructive",
          isOpen && "ring-2 ring-primary/20 border-primary"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="combobox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
          {safeValue.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                {safeValue.length} {safeValue.length === 1 ? "Specialty" : "Specialties"} Selected
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                (Click to add/remove departments)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {safeValue.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="p-1 hover:text-destructive text-muted-foreground transition-colors mr-1"
              title="Clear all selected"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronsUpDown className="h-4 w-4" />
        </div>
      </div>

      {/* Selected Pills / Badges Display */}
      {safeValue.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md border border-border/60 max-h-36 overflow-y-auto">
          {safeValue.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="pl-2 pr-1 py-1 text-xs font-normal gap-1 bg-background border hover:bg-secondary/60 flex items-center"
            >
              <span className="truncate max-w-[220px]">{item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeSpecialty(item, e)}
                  className="rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                  title={`Remove ${item}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Quick Add Other Button outside */}
      {!disabled && (
        <div className="flex items-center justify-between pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => customInputRef.current?.focus(), 60);
            }}
            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 px-2 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Others / Custom Specialty</span>
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {safeValue.length} department{safeValue.length === 1 ? "" : "s"} selected
          </span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="relative z-[100]">
          <div className="absolute top-0 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-80">
            {/* Search, Custom Add and Quick Actions Bar */}
            <div className="p-2 border-b space-y-2 bg-muted/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search medical specialties & departments..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                  autoFocus
                />
              </div>

              {/* Add Other / Custom Department Input Row */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <Input
                  ref={customInputRef}
                  type="text"
                  placeholder="Type custom specialty name..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      addCustomSpecialty(customInput);
                    }
                  }}
                  className="h-8 text-xs bg-background flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addCustomSpecialty(customInput);
                  }}
                  disabled={!customInput.trim()}
                  className="h-8 text-xs px-2.5 font-semibold shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Other
                </Button>
              </div>

              <div className="flex items-center justify-between text-[11px] px-1 text-muted-foreground">
                <span>
                  Showing {filtered.length} of {allKnownSpecialties.length} departments
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <CheckSquare className="h-3 w-3" />
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="hover:underline text-destructive inline-flex items-center gap-1"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Specialties List with Checkboxes */}
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              {/* Instant Add Query as Custom Option if not present */}
              {query.trim() && !safeValue.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
                <div
                  onClick={() => addCustomSpecialty(query)}
                  className="flex items-center gap-2 p-2 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-dashed border-primary/40 cursor-pointer text-xs font-semibold transition-colors mb-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add &ldquo;{query.trim()}&rdquo; as custom department</span>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No matching medical specialty found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((specialty) => {
                  const isSelected = safeValue.includes(specialty);
                  const isCustom = !(MEDICAL_SPECIALIZATIONS as readonly string[]).includes(specialty);
                  return (
                    <div
                      key={specialty}
                      onClick={() => toggleSpecialty(specialty)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 text-xs rounded-sm cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent hover:text-accent-foreground text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {isSelected ? (
                          <div className="h-4 w-4 rounded bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded border border-muted-foreground/40 shrink-0" />
                        )}
                        <span>{specialty}</span>
                        {isCustom && (
                          <span className="text-[10px] bg-secondary px-1.5 py-0.2 rounded text-muted-foreground">
                            Custom
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-primary/70 font-mono">Added</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Done Bar */}
            <div className="p-2 border-t bg-muted/40 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                No limit on selections. Choose all that apply.
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setIsOpen(false)}
              >
                Done ({safeValue.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
