"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { FaqItem } from "@/types";
import { useWebsiteThemeMode } from "./website-mode-context";
import { cn } from "@/lib/utils";

interface FaqAccordionProps {
  faqs?: FaqItem[];
  className?: string;
  itemClassName?: string;
}

export function FaqAccordion({ faqs = [], className, itemClassName }: FaqAccordionProps) {
  const { isDark } = useWebsiteThemeMode();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const displayFaqs = React.useMemo(() => {
    if (faqs && faqs.length > 0) return faqs;
    return [
      {
        question: "How do I book a consultation appointment?",
        answer: "You can book directly using the online appointment button above, or contact our clinic reception by phone.",
      },
      {
        question: "What documents should I bring to my consultation?",
        answer: "Please bring past medical records, prescription history, lab reports, and a valid photo identification.",
      },
      {
        question: "Are walk-ins accommodated?",
        answer: "Walk-ins are accommodated based on daily clinical triage, though prior booking is highly recommended.",
      },
    ];
  }, [faqs]);

  return (
    <div className={cn("space-y-3", className)}>
      {displayFaqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={cn(
              "group relative rounded-2xl border transition-all overflow-hidden",
              isOpen ? "shadow-sm border-[var(--theme-primary)]/50" : "hover:border-[var(--theme-primary)]/30",
              itemClassName
            )}
            style={{
              backgroundColor: isDark ? "var(--theme-inner-card-bg, rgba(255,255,255,0.04))" : "#ffffff",
              borderColor: isOpen
                ? "var(--theme-primary)"
                : isDark
                ? "var(--theme-card-border, #334155)"
                : "var(--theme-card-border, rgba(5, 150, 105, 0.25))",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm sm:text-base text-foreground focus:outline-hidden"
            >
              <span className="pr-3">{faq.question}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground",
                  isOpen && "rotate-180 text-primary"
                )}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed animate-in fade-in-50 border-t border-border/40">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
