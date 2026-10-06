"use client";

import * as React from "react";
import { MessageSquare, X, Send, Bot, ShieldAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChatbotWidgetProps {
  entityName: string;
  specialization?: string;
  consultationHours?: string;
  addressSummary?: string;
}

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}

export function ChatbotWidget({
  entityName,
  specialization,
  consultationHours,
  addressSummary,
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "initial-1",
      sender: "bot",
      text: `Hello! I am the automated practice assistant for ${entityName}${specialization ? ` (${specialization})` : ""}. I can provide practice information, consultation hours, and appointment guidance. How can I help you today?`,
      time: "Just now",
    },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Deterministic response generator adhering to medical guardrails
    // (Never diagnose, never prescribe, provides administrative/practice guidelines)
    setTimeout(() => {
      let reply = `Thank you for your inquiry. For specific clinical consultations, please schedule an appointment with ${entityName}.`;

      const lower = query.toLowerCase();
      if (lower.includes("hour") || lower.includes("time") || lower.includes("when") || lower.includes("open")) {
        reply = consultationHours
          ? `${entityName} operates during these timings: ${consultationHours}. Please check the schedule section above for full slot details.`
          : `${entityName} is available for consultation according to the weekly schedule shown on this website. Please refer to the consultation hours section or contact our desk.`;
      } else if (lower.includes("where") || lower.includes("address") || lower.includes("location") || lower.includes("city")) {
        reply = addressSummary
          ? `${entityName} is located at: ${addressSummary}.`
          : `Please see the location and contact section on this page for complete address details.`;
      } else if (lower.includes("appointment") || lower.includes("book") || lower.includes("cost") || lower.includes("fee")) {
        reply = `You can request an appointment directly through the "Book Appointment" or "WhatsApp Direct" buttons on this website. Our clinical coordinator will assist with scheduling and fee inquiries.`;
      } else if (lower.includes("pain") || lower.includes("symptom") || lower.includes("medicine") || lower.includes("cure") || lower.includes("tablet") || lower.includes("prescribe")) {
        reply = `Important Notice: As an automated informational assistant, I cannot provide medical diagnosis, treatment advice, or drug prescriptions. Please schedule an in-person consultation with ${entityName} or contact emergency services immediately if you are experiencing severe symptoms.`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: reply,
        time: "Just now",
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300",
          isOpen
            ? "bg-neutral-800 text-white rotate-90"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-primary/30"
        )}
        aria-label="Toggle Practice Assistant Chat"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>

      {/* Chat Window Drawer */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-[90vw] sm:w-[380px] max-h-[520px] h-[500px] flex flex-col shadow-2xl border border-border animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground p-4 rounded-t-lg flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">{entityName}</CardTitle>
                <div className="flex items-center gap-1 text-[11px] text-primary-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Practice Assistant
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>

          {/* Medical Guardrail Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 px-3 py-1.5 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>Practice info only. Does not diagnose or prescribe.</span>
          </div>

          <CardContent className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 max-w-[85%]",
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5",
                    msg.sender === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {msg.sender === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </div>
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-secondary/60 text-foreground border border-border/50 rounded-bl-xs"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </CardContent>

          <CardFooter className="p-3 border-t bg-card">
            <form onSubmit={handleSend} className="flex w-full gap-2">
              <Input
                placeholder="Ask about hours, location, booking..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-9 text-xs"
              />
              <Button type="submit" size="sm" className="h-9 px-3">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
