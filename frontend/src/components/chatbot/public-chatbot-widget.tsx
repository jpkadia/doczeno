"use client";

import * as React from "react";
import { MessageSquare, X, Send, Bot, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PublicChatbotWidgetProps {
  slug: string;
  doctorSlug?: string;
  parentHospitalSlug?: string;
  displayName: string;
  websiteType?: string;
}

export function PublicChatbotWidget({
  slug,
  doctorSlug,
  parentHospitalSlug,
  displayName,
  websiteType,
}: PublicChatbotWidgetProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Generate or retrieve persistent sessionId for this visitor session
  const [sessionId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(`dz_chat_${slug}_${doctorSlug || ""}`);
      if (stored) return stored;
      const created = `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem(`dz_chat_${slug}_${doctorSlug || ""}`, created);
      return created;
    }
    return `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      role: "assistant",
      content: `Hello! I am the virtual assistant for ${displayName}. I can help you with consultation hours, appointment booking, clinic location, and services. How may I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  };

  React.useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const suggestedQuestions = [
    "What are consultation hours?",
    "How can I book an appointment?",
    "Where is the clinic located?",
    websiteType === "HOSPITAL_CLINIC" ? "What medical specialties are available?" : "What services are offered?",
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    if (text.length > 500) {
      setErrorMessage("Message is too long. Please keep under 500 characters.");
      return;
    }

    setErrorMessage(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Determine correct slug parameters
      const primarySlug = parentHospitalSlug || slug;
      const childDocSlug = parentHospitalSlug ? doctorSlug : (websiteType === "HOSPITAL_DOCTOR" ? doctorSlug : undefined);

      const response = await apiClient.post<{
        success: boolean;
        response: string;
        sessionId: string;
        turnCount?: number;
      }>("/chatbot/public/message", {
        slug: primarySlug,
        doctorSlug: childDocSlug,
        message: text,
        sessionId,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to deliver message. Please try again shortly.";
      setErrorMessage(msg);
      const failMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: msg.includes("Too many requests")
          ? "You have reached the rate limit. Please wait a moment before sending another message."
          : "I am having trouble connecting to the practice knowledge service right now. Please call the clinic directly.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, failMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans print:hidden">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          aria-label={`Open AI Assistant for ${displayName}`}
        >
          <div className="relative">
            <MessageSquare className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200" />
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide">
            Chat with {displayName}
          </span>
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[400px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-tight truncate">
                  {displayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-slate-300">Practice AI Assistant</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Medical Safety Disclaimer Notice */}
          <div className="bg-amber-50 border-b border-amber-200/60 px-3.5 py-2 flex items-start gap-2 text-[11px] text-amber-800 leading-tight">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Practice Info Only:</strong> Not for medical diagnosis or prescription. In emergency, contact local hospital emergency immediately.
            </span>
          </div>

          {/* Message Thread List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs whitespace-pre-line",
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-xs"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 max-w-[80%] shadow-2xs">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                <span>Finding practice details...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips (shown when thread is short) */}
          {messages.length <= 2 && !loading && (
            <div className="p-2.5 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200/70 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input & Footer Controls */}
          <div className="p-3 bg-white border-t border-slate-200">
            {errorMessage && (
              <div className="mb-2 text-[11px] text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about hours, location, booking..."
                  maxLength={500}
                  disabled={loading}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                />
                <span className="absolute right-2.5 bottom-1 text-[9px] text-slate-400">
                  {input.length}/500
                </span>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-3 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="mt-2 text-center text-[10px] text-slate-400">
              Powered by Doczeno Healthcare Engine
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
