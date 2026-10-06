"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { FaqItem } from "@/types";
import { cn } from "@/lib/utils";

interface FaqAccordionProps {
  faqs?: FaqItem[];
  className?: string;
  itemClassName?: string;
}

export function FaqAccordion({ faqs = [], className, itemClassName }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  if (!faqs || faqs.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={cn(
              "rounded-lg border border-border bg-card transition-all overflow-hidden",
              isOpen ? "shadow-sm border-primary/40" : "hover:border-border/80",
              itemClassName
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm sm:text-base text-foreground transition-colors hover:text-primary"
              aria-expanded={isOpen}
            >
              <span>{faq.question}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground",
                  isOpen && "rotate-180 text-primary"
                )}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed animate-in fade-in-50">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
