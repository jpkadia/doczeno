"use client";

import * as React from "react";
import { X, Send, Bot, AlertCircle, RefreshCw, RotateCcw, Copy, Check, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient, warmUpBackend } from "@/lib/api-client";
import { resolveThemePalette } from "@/lib/theme-palettes";
import { useWebsiteThemeMode } from "@/components/themes/shared/website-mode-context";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  appointmentId?: string;
  isAppointmentBooked?: boolean;
}

interface PublicChatbotWidgetProps {
  slug: string;
  doctorSlug?: string;
  parentHospitalSlug?: string;
  displayName: string;
  websiteType?: string;
  selectedTheme?: string;
}

function extractTrackingId(text: string): string | null {
  if (!text) return null;
  const match = text.match(/Appointment ID:\s*([A-Za-z0-9_-]+)/i);
  return match && match[1] ? match[1] : null;
}

function cleanPlainText(text: string): string {
  if (!text) return "";
  let clean = text;
  // 1. Remove all emojis, symbols, and pictographs
  clean = clean.replace(
    /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}\u{20E3}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{3297}\u{3299}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}]/gu,
    ""
  );
  // 2. Strip bold markdown (**text** or __text__)
  clean = clean.replace(/\*\*(.*?)\*\*/g, "$1");
  clean = clean.replace(/__(.*?)__/g, "$1");
  // 3. Strip italic markdown (*text* or _text_) while preserving URLs
  clean = clean.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1$2$3");
  clean = clean.replace(/\bhttps?:\/\/[^\s]+/gi, (url) => url.replace(/_/g, "__URL_UNDERSCORE__"));
  clean = clean.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1$2$3");
  clean = clean.replace(/__URL_UNDERSCORE__/g, "_");
  // 4. Strip html tags
  clean = clean.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  // 5. Strip markdown headers
  clean = clean.replace(/^#{1,6}\s+/gm, "");
  // 6. Strip markdown links
  clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");
  // 7. Replace markdown bullets
  clean = clean.replace(/^\s*\*\s+/gm, "- ");
  // 8. Collapse extra whitespace
  clean = clean.replace(/[ \t]{2,}/g, " ");
  return clean.trim();
}

function renderMessageWithLinks(text: string, isUser: boolean, linkColor?: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);
  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    if (!/^https?:\/\//i.test(part)) {
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    }
    const cleanUrl = part.replace(/[.,;!?)]+$/, "");
    const trailing = part.slice(cleanUrl.length);
    return (
      <React.Fragment key={idx}>
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold break-all hover:opacity-80"
          style={isUser ? { color: "#ffffff" } : { color: linkColor || "#2563eb" }}
        >
          {cleanUrl}
        </a>
        {trailing}
      </React.Fragment>
    );
  });
}

export function PublicChatbotWidget({
  slug,
  doctorSlug,
  parentHospitalSlug,
  displayName,
  websiteType,
  selectedTheme,
}: PublicChatbotWidgetProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = resolveThemePalette(selectedTheme);
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      warmUpBackend();
    }
  }, [isOpen]);

  // Auto-expand textarea height like WhatsApp as text grows or Enter is pressed
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 38), 128);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const handleCopyTrackingId = async (id: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = id;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 2500);
    } catch (err) {
      console.error("Failed to copy tracking ID", err);
    }
  };

  // Generate or retrieve persistent sessionId for this visitor session across tabs via localStorage
  const [sessionId, setSessionId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(`dz_chat_${slug}_${doctorSlug || ""}`);
      if (stored) return stored;
      const created = `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.localStorage.setItem(`dz_chat_${slug}_${doctorSlug || ""}`, created);
      return created;
    }
    return `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const defaultGreeting: ChatMessage = {
    id: "initial-greeting",
    role: "assistant",
    content: `Hello! I am the virtual assistant for ${displayName}. I can help you with consultation hours, doctor credentials, clinic location, and appointment booking. You can also ask in Hindi, Gujarati, or English. How may I assist you today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      const storedSession = window.localStorage.getItem(`dz_chat_${slug}_${doctorSlug || ""}`);
      if (storedSession) {
        const cached = window.localStorage.getItem(`dz_chat_messages_${storedSession}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch {
            // ignore cache parse failure
          }
        }
      }
    }
    return [defaultGreeting];
  });

  // Synchronize messages with localStorage whenever they change
  React.useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.setItem(`dz_chat_messages_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  // Rehydrate past conversation turns from backend on mount if page was refreshed or opened in new tab
  React.useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!sessionId) return;
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: { messages?: Array<{ role: string; content: string; timestamp?: string }> };
        }>(`/chatbot/public/history/${sessionId}`);

        if (isMounted && res.data?.messages && res.data.messages.length > 0) {
          const loaded: ChatMessage[] = res.data.messages.map((m, idx) => {
            const trackingId = extractTrackingId(m.content) || undefined;
            return {
              id: `hist-${idx}-${Date.now()}`,
              role: m.role === "user" ? "user" : "assistant",
              content: cleanPlainText(m.content),
              timestamp: m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              appointmentId: trackingId,
              isAppointmentBooked: Boolean(trackingId),
            };
          });

          setMessages(loaded);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(`dz_chat_messages_${sessionId}`, JSON.stringify(loaded));
          }
        }
      } catch {
        // Fallback to cached or initial state gracefully
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleClearChat = () => {
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.removeItem(`dz_chat_messages_${sessionId}`);
    }
    const newSessionId = `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    const newGreeting: ChatMessage = {
      ...defaultGreeting,
      id: `initial-greeting-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`dz_chat_${slug}_${doctorSlug || ""}`, newSessionId);
      window.localStorage.setItem(`dz_chat_messages_${newSessionId}`, JSON.stringify([newGreeting]));
    }
    setMessages([newGreeting]);
    setErrorMessage(null);
  };

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
        appointmentId?: string;
        isAppointmentBooked?: boolean;
      }>("/chatbot/public/message", {
        slug: primarySlug,
        doctorSlug: childDocSlug,
        message: text,
        sessionId,
      });

      const extractedId = response.appointmentId || extractTrackingId(response.response) || undefined;

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        appointmentId: extractedId,
        isAppointmentBooked: response.isAppointmentBooked || Boolean(extractedId),
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
          : "I am having trouble connecting to the clinic knowledge service right now. Please call the clinic directly.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, failMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // On mobile devices (screen width < 768 or touch pointer):
      // Enter key adds a new line; message is sent strictly by clicking the Send button
      const isMobile =
        typeof window !== "undefined" &&
        (window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches);

      if (isMobile) {
        return; // Allow native newline in textarea
      }

      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={cn(
        "fixed z-50 font-sans print:hidden",
        isOpen
          ? "bottom-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:bottom-6 flex justify-end"
          : "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 min-[1033px]:bottom-6"
      )}
    >
      {/* Floating Toggle Button with Active Theme and Smooth Breathing Pulse Animation */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            backgroundColor: theme.primary,
          }}
          className="group relative flex items-center justify-center h-12 w-12 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 animate-ai-breathe"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.primaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.primary;
          }}
          aria-label={`Open AI Assistant for ${displayName}`}
        >
          <div className="relative flex items-center justify-center">
            <Bot className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: theme.primaryLight || "#ffffff" }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: "#ffffff" }}
              />
            </span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div
          className={cn(
            "flex flex-col w-full sm:w-[400px] h-[520px] max-h-[82dvh] sm:h-[550px] sm:max-h-[85vh] rounded-2xl shadow-2xl border overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4",
            isDark ? "shadow-black/70" : "shadow-2xl"
          )}
          style={{
            backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
            borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
          }}
        >
          {/* Header */}
          <div
            className="p-3.5 sm:p-4 flex items-center justify-between shadow-xs border-b shrink-0"
            style={{
              backgroundColor: isDark ? theme.headerBgDark || theme.innerCardBgDark : "#0f172a",
              borderColor: isDark ? theme.cardBorderDark : "transparent",
              color: "#ffffff",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center border"
                style={{
                  backgroundColor: `${theme.primary}25`,
                  color: isDark ? theme.primaryLight : "#ffffff",
                  borderColor: `${theme.primary}50`,
                }}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-tight truncate text-white">
                  {displayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: theme.primaryLight }}
                  />
                  <span className="text-[11px] text-slate-300">Clinic AI Assistant</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors focus:outline-none"
                title="Clear chat screen (starts fresh chat in browser)"
                aria-label="Clear chat screen"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors focus:outline-none"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Medical Safety Disclaimer Notice */}
          <div
            className={cn(
              "border-b px-3.5 py-2 flex items-start gap-2 text-[11px] leading-tight shrink-0",
              isDark
                ? "bg-amber-950/30 border-amber-900/40 text-amber-300"
                : "bg-amber-50 border-amber-200/60 text-amber-800"
            )}
          >
            <AlertCircle className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isDark ? "text-amber-400" : "text-amber-600")} />
            <span>
              <strong>Clinic Info Only:</strong> Not for medical diagnosis or prescription. In emergency, contact local hospital emergency immediately.
            </span>
          </div>

          {/* Message Thread List */}
          <div
            className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3"
            style={{
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.2)" : "#f8fafc",
            }}
          >
            {messages.map((msg) => {
              const trackingId = msg.appointmentId || (msg.role === "assistant" ? extractTrackingId(msg.content) : null);
              const isCopied = trackingId ? copiedId === trackingId : false;

              return (
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
                        ? "text-white rounded-br-xs"
                        : "rounded-bl-xs border"
                    )}
                    style={
                      msg.role === "user"
                        ? { backgroundColor: theme.primary, color: "#ffffff" }
                        : {
                            backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                            borderColor: isDark ? theme.cardBorderDark : "rgba(226, 232, 240, 0.9)",
                            color: isDark ? "#f1f5f9" : "#1e293b",
                          }
                    }
                  >
                    {renderMessageWithLinks(
                      cleanPlainText(msg.content),
                      msg.role === "user",
                      isDark ? "#60a5fa" : theme.primary
                    )}

                    {/* Dedicated 1-Click Copy Card for Appointment Tracking ID */}
                    {trackingId && (
                      <div
                        className={cn(
                          "mt-3 pt-2.5 border-t rounded-xl p-2.5 flex flex-col gap-2 transition-all",
                          isDark
                            ? "bg-slate-900/60 border-slate-700/60 text-slate-200"
                            : "bg-slate-50 border-slate-200/80 text-slate-800"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Ticket className="h-3.5 w-3.5" style={{ color: theme.primaryLight || theme.primary }} />
                            <span>Appointment ID</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-700">
                            Confirmed
                          </span>
                        </div>

                        <div
                          onClick={() => handleCopyTrackingId(trackingId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleCopyTrackingId(trackingId);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer select-none",
                            isCopied
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600"
                              : "bg-white dark:bg-black/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          )}
                          title="Click to copy Tracking ID"
                        >
                          <span className="font-mono text-xs font-bold tracking-wider select-all text-slate-900 dark:text-slate-100">
                            {trackingId}
                          </span>

                          <div
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-all",
                              isCopied
                                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                : "text-slate-600 dark:text-slate-300"
                            )}
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-50" />
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span className="text-[10px]">Copy ID</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                          Click above to copy ID and check live status in &apos;Appointment Status&apos;.
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={cn("text-[9px] mt-1 px-1", isDark ? "text-slate-500" : "text-slate-400")}>
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {loading && (
              <div
                className="flex items-center gap-2 text-xs rounded-2xl px-3.5 py-2.5 max-w-[80%] shadow-2xs border"
                style={{
                  backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                  borderColor: isDark ? theme.cardBorderDark : "rgba(226, 232, 240, 0.9)",
                  color: isDark ? "#94a3b8" : "#64748b",
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: theme.primaryLight }} />
                <span>Finding clinic details...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips (shown when thread is short) */}
          {messages.length <= 2 && !loading && (
            <div
              className="p-2.5 border-t flex flex-wrap gap-1.5 shrink-0"
              style={{
                backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
                borderColor: isDark ? theme.cardBorderDark : "#f1f5f9",
              }}
            >
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors text-left",
                    isDark
                      ? "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/70"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input & Footer Controls */}
          <div
            className="p-3 border-t shrink-0"
            style={{
              backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
              borderColor: isDark ? theme.cardBorderDark : "#e2e8f0",
            }}
          >
            {errorMessage && (
              <div className="mb-2 text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something..."
                  maxLength={500}
                  disabled={loading}
                  className={cn(
                    "block w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none disabled:opacity-60 resize-none max-h-32 leading-relaxed overflow-y-auto transition-[height] duration-75",
                    isDark
                      ? "text-white placeholder-slate-500"
                      : "text-slate-800 placeholder-slate-400 focus:bg-white"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.innerCardBgDark : "#f1f5f9",
                    borderColor: isDark ? theme.cardBorderDark : "#cbd5e1",
                    minHeight: "40px",
                    maxHeight: "128px",
                  }}
                />
              </div>

              <Button
                type="submit"
                aria-label="Send message"
                disabled={loading || !input.trim()}
                style={{
                  backgroundColor: theme.primary,
                }}
                className="hover:opacity-90 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className={cn("mt-2 text-center text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>
              Powered by Doczeno Healthcare Engine
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
