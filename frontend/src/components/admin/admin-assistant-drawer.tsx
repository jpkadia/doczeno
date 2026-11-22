"use client";

import * as React from "react";
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  RotateCcw,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface AdminAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolExecuted?: string;
  pendingConfirmation?: {
    actionId: string;
    actionType: string;
    parameters: Record<string, unknown>;
    expiresAt: string;
  };
}

interface AdminAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roleBadge: string;
  portalTitle: string;
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
  // 3. Strip italic markdown (*text* or _text_)
  clean = clean.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1$2$3");
  clean = clean.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1$2$3");
  // 4. Strip html tags
  clean = clean.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  // 5. Strip markdown headers
  clean = clean.replace(/^#{1,6}\s+/gm, "");
  // 6. Strip markdown links
  clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");
  // 7. Replace markdown bullets
  clean = clean.replace(/^\s*\*\s+/gm, "- ");
  // 8. Collapse extra horizontal whitespace
  clean = clean.replace(/[ \t]{2,}/g, " ");
  return clean.trim();
}

export function AdminAssistantDrawer({
  isOpen,
  onClose,
  roleBadge,
  portalTitle,
}: AdminAssistantDrawerProps) {
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    actionId: string;
    actionType: string;
    parameters: Record<string, unknown>;
    prompt: string;
  } | null>(null);

  // Generate or retrieve persistent sessionId
  const [sessionId, setSessionId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("dz_admin_copilot_session");
      if (stored) return stored;
      const created = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem("dz_admin_copilot_session", created);
      return created;
    }
    return `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const defaultGreeting: AdminAssistantMessage = {
    id: "initial-assistant-prompt",
    role: "assistant",
    content: `Hello! I am your administrative AI assistant for ${portalTitle}. I can fetch appointment summaries, review doctor rosters, check schedule settings, and assist with profile updates. You can ask in English, Hinglish, or Gujarati. What would you like to check?`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const [messages, setMessages] = React.useState<AdminAssistantMessage[]>(() => {
    if (typeof window !== "undefined") {
      const storedSession = window.sessionStorage.getItem("dz_admin_copilot_session");
      if (storedSession) {
        const cached = window.sessionStorage.getItem(`dz_admin_copilot_messages_${storedSession}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch {
            // ignore cache parse error
          }
        }
      }
    }
    return [defaultGreeting];
  });

  // Synchronize messages with sessionStorage whenever they change
  React.useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      window.sessionStorage.setItem(`dz_admin_copilot_messages_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  // Rehydrate previous turns from backend on mount if page was refreshed
  React.useEffect(() => {
    let isMounted = true;
    async function loadAdminHistory() {
      if (!sessionId) return;
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: { messages?: Array<{ role: string; content: string; timestamp?: string }> };
        }>(`/chatbot/admin/history/${sessionId}`);

        if (isMounted && res.data?.messages && res.data.messages.length > 0) {
          const loaded: AdminAssistantMessage[] = res.data.messages.map((m, idx) => ({
            id: `admin-hist-${idx}-${Date.now()}`,
            role: m.role === "user" ? "user" : "assistant",
            content: cleanPlainText(m.content),
            timestamp: m.timestamp
              ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }));

          setMessages(loaded);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(`dz_admin_copilot_messages_${sessionId}`, JSON.stringify(loaded));
          }
        }
      } catch {
        // Fallback to cached or initial state
      }
    }

    loadAdminHistory();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleClearChat = () => {
    if (typeof window !== "undefined" && sessionId) {
      window.sessionStorage.removeItem(`dz_admin_copilot_messages_${sessionId}`);
    }
    const newSessionId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    const newGreeting: AdminAssistantMessage = {
      ...defaultGreeting,
      id: `initial-assistant-prompt-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("dz_admin_copilot_session", newSessionId);
      window.sessionStorage.setItem(`dz_admin_copilot_messages_${newSessionId}`, JSON.stringify([newGreeting]));
    }
    setMessages([newGreeting]);
    setPendingAction(null);
    setErrorMessage(null);
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, isOpen, pendingAction]);

  const quickPrompts = [
    { label: "Upcoming Appointments", prompt: "Show upcoming appointments" },
    { label: "Clinic Profile", prompt: "Summarize current profile and contact info" },
    { label: "Doctor Directory", prompt: "List active doctors" },
    { label: "Working Hours", prompt: "What are our consultation and working hours?" },
  ];

  const handleSendMessage = async (textToSend?: string, confirmActionId?: string) => {
    const text = (textToSend || input).trim();
    if ((!text && !confirmActionId) || loading) return;

    if (text.length > 500) {
      setErrorMessage("Message exceeds 500 characters limit.");
      return;
    }

    setErrorMessage(null);
    setInput("");

    const userMessage: AdminAssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: confirmActionId ? "Confirmed action." : text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        response: string;
        sessionId: string;
        toolExecuted?: string;
        pendingConfirmation?: {
          actionId: string;
          actionType: string;
          parameters: Record<string, unknown>;
          expiresAt: string;
        };
      }>("/chatbot/admin/message", {
        message: text,
        sessionId,
        confirmActionId,
      });

      if (response.pendingConfirmation) {
        setPendingAction({
          actionId: response.pendingConfirmation.actionId,
          actionType: response.pendingConfirmation.actionType,
          parameters: response.pendingConfirmation.parameters,
          prompt: response.response,
        });
      } else {
        setPendingAction(null);
      }

      const assistantMessage: AdminAssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolExecuted: response.toolExecuted,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to reach AI assistant service.";
      setErrorMessage(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${msg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
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

  const handleCancelPendingAction = () => {
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel-${Date.now()}`,
        role: "assistant",
        content: "Action was cancelled. No changes were made.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans print:hidden">
      <div className="flex flex-col w-[360px] sm:w-[400px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#1a76d1]/20 text-[#60a5fa] border border-[#1a76d1]/40 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm leading-tight truncate">
                  AI Copilot
                </h3>
                <Badge variant="outline" className="text-[10px] bg-slate-800 text-blue-300 border-slate-700">
                  {roleBadge}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-[#1a76d1] shrink-0" />
                <p className="text-[11px] text-slate-300 truncate max-w-[200px] sm:max-w-[230px]">
                  {portalTitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700"
              title="Clear chat screen (starts fresh conversation in browser)"
              aria-label="Clear chat screen"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700"
              aria-label="Close Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Security & Isolation Notice Banner */}
        <div className="bg-blue-50/80 border-b border-blue-100 px-3.5 py-2 flex items-start gap-2 text-[11px] text-blue-900 leading-tight">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1a76d1] shrink-0 mt-0.5" />
          <span>
            Operating in protected clinic workspace. Your clinical records and settings remain private.
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
              {msg.toolExecuted && (
                <div className="mb-1 flex items-center gap-1 text-[10px] text-[#1560aa] font-mono bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Executed tool: {msg.toolExecuted}</span>
                </div>
              )}

              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs whitespace-pre-line",
                  msg.role === "user"
                    ? "bg-[#1a76d1] text-white rounded-br-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                )}
              >
                {cleanPlainText(msg.content)}
              </div>

              <span className="text-[9px] text-slate-400 mt-1 px-1">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Pending Destructive Action Confirmation Card */}
          {pendingAction && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 shadow-2xs animate-in fade-in space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-amber-900">
                    Confirmation Required (Destructive Action)
                  </h4>
                  <p className="text-xs text-amber-800 mt-1">
                    {cleanPlainText(pendingAction.prompt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={loading}
                  onClick={() => handleSendMessage("confirm", pendingAction.actionId)}
                  className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Confirm & Execute
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={handleCancelPendingAction}
                  className="text-xs h-8 border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 max-w-[80%] shadow-2xs">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1a76d1]" />
              <span>Analyzing records and processing request...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && !loading && !pendingAction && (
          <div className="p-2.5 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
            {quickPrompts.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-[#1560aa] text-slate-600 px-2.5 py-1 rounded-full border border-slate-200/70 transition-colors text-left"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Input & Footer Controls */}
        <div className="p-3 bg-white border-t border-slate-200">
          {errorMessage && (
            <div className="mb-2 text-[11px] text-rose-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
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
                placeholder="Ask assistant to fetch records or manage profile..."
                maxLength={500}
                disabled={loading || Boolean(pendingAction)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a76d1] focus:border-[#1a76d1] disabled:opacity-60"
              />
              <span className="absolute right-2.5 bottom-1 text-[9px] text-slate-400">
                {input.length}/500
              </span>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim() || Boolean(pendingAction)}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white rounded-xl h-9 px-3 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
          <div className="mt-2 text-center text-[10px] text-slate-400">
            Powered by Doczeno Healthcare Engine
          </div>
        </div>
      </div>
    </div>
  );
}
