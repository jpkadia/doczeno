"use client";

import * as React from "react";
import { MEDICAL_SPECIALIZATIONS } from "@/constants/healthcare";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecializationSelectProps {
  value?: string;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  options?: readonly string[] | string[];
  placeholder?: string;
  emptyMessage?: string;
}

export function SpecializationSelect({
  value,
  onChange,
  error,
  disabled,
  options,
  placeholder = "Select Medical Specialization",
  emptyMessage = "No matching specialization found",
}: SpecializationSelectProps) {
  const [query, setQuery] = React.useState("");
  const [customInput, setCustomInput] = React.useState("");
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // If value is custom (not in standard list), ensure it's in the options list
  const availableOptions = React.useMemo(() => {
    const base = options || MEDICAL_SPECIALIZATIONS;
    if (value && !(base as readonly string[]).includes(value)) {
      return [value, ...base];
    }
    return base;
  }, [options, value]);

  const filtered = React.useMemo(() => {
    if (!query) return availableOptions;
    return availableOptions.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, availableOptions]);

  const hasExactMatch = React.useMemo(() => {
    if (!query.trim()) return true;
    return availableOptions.some(
      (s) => s.toLowerCase() === query.trim().toLowerCase()
    );
  }, [query, availableOptions]);

  const handleAddCustom = (specialtyName: string) => {
    const trimmed = specialtyName.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setQuery("");
    setCustomInput("");
    setShowCustomInput(false);
    setIsOpen(false);
  };

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

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive ring-1 ring-destructive"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="specialization-options-list"
      >
        <span className={value ? "text-foreground font-medium" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>

      {isOpen && !disabled && (
        <div
          id="specialization-options-list"
          className="absolute z-[100] mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-80"
        >
          <div className="p-1 sticky top-0 bg-popover z-10 space-y-1">
            <Input
              type="text"
              placeholder="Search specialty (e.g. Cardiology)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
          </div>

          <div className="py-1">
            {/* Quick-add chip if user searched for something not in the list */}
            {!hasExactMatch && query.trim().length > 1 && (
              <div
                className="flex items-center gap-1.5 px-2 py-2 text-xs rounded-sm cursor-pointer bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors mb-1 border border-primary/20"
                onClick={() => handleAddCustom(query)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add &quot;{query.trim()}&quot; as custom specialty</span>
              </div>
            )}

            {filtered.length === 0 && hasExactMatch ? (
              <p className="p-2 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((specialty) => (
                <div
                  key={specialty}
                  className={cn(
                    "flex items-center px-2 py-1.5 text-xs rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === specialty && "bg-primary/10 text-primary font-semibold"
                  )}
                  onClick={() => {
                    onChange(specialty);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  {specialty}
                </div>
              ))
            )}
          </div>

          {/* Bottom Add Other Section (Task 2: hospital form parity) */}
          <div className="p-2 border-t border-border mt-1 bg-muted/40 rounded-b-md">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline py-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add other specialty</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  placeholder="Enter other specialty..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustom(customInput);
                    }
                  }}
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddCustom(customInput)}
                  disabled={!customInput.trim()}
                  className="h-7 px-2.5 text-xs font-semibold"
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
