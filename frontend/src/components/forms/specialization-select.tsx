"use client";

import * as React from "react";
import { MEDICAL_SPECIALIZATIONS, MedicalSpecialization } from "@/constants/healthcare";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecializationSelectProps {
  value?: string;
  onChange: (value: MedicalSpecialization) => void;
  error?: string;
  disabled?: boolean;
}

export function SpecializationSelect({
  value,
  onChange,
  error,
  disabled,
}: SpecializationSelectProps) {
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!query) return MEDICAL_SPECIALIZATIONS;
    return MEDICAL_SPECIALIZATIONS.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

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
          {value || "Select Medical Specialization"}
        </span>
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>

      {isOpen && !disabled && (
        <div
          id="specialization-options-list"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80"
        >
          <div className="p-1 sticky top-0 bg-popover z-10">
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
            {filtered.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">
                No matching specialization found
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
        </div>
      )}
    </div>
  );
}
