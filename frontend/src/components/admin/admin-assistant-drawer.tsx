"use client";

import * as React from "react";
import {
  X,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
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
  practiceTitle: string;
}

export function AdminAssistantDrawer({
  isOpen,
  onClose,
  roleBadge,
  practiceTitle,
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
  const [sessionId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("dz_admin_copilot_session");
      if (stored) return stored;
      const created = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem("dz_admin_copilot_session", created);
      return created;
    }
    return `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const [messages, setMessages] = React.useState<AdminAssistantMessage[]>([
    {
      id: "initial-assistant-prompt",
      role: "assistant",
      content: `Hello! I am your administrative AI assistant for ${practiceTitle}. I can fetch appointment summaries, review doctor rosters, check schedule settings, and assist with profile updates. What would you like to check?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, isOpen, pendingAction]);

  const quickPrompts = [
    { label: "Upcoming Appointments", prompt: "Show upcoming appointments" },
    { label: "Practice Profile", prompt: "Summarize current profile and contact info" },
    { label: "Doctor Directory", prompt: "List active doctors in the practice" },
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">
                  Practice Copilot
                </h3>
                <Badge variant="outline" className="text-[10px] bg-slate-800 text-emerald-300 border-slate-700">
                  {roleBadge}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                {practiceTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors focus:outline-none"
            aria-label="Close Assistant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security & Isolation Notice Banner */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Operating with strict tenant permissions. Read and write actions are audited.
          </span>
        </div>

        {/* Conversation Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[90%]",
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {msg.toolExecuted && (
                <div className="mb-1 flex items-center gap-1 text-[10px] text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Executed tool: {msg.toolExecuted}</span>
                </div>
              )}

              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs whitespace-pre-line",
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-br-xs"
                    : "bg-white text-slate-900 border border-slate-200 rounded-bl-xs"
                )}
              >
                {msg.content}
              </div>

              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Pending Destructive Action Confirmation Card */}
          {pendingAction && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm animate-in fade-in space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-amber-900">
                    Confirmation Required (Destructive Action)
                  </h4>
                  <p className="text-xs text-amber-800 mt-1">
                    {pendingAction.prompt}
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
            <div className="flex items-center gap-2 text-slate-600 text-xs bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[80%] shadow-2xs">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              <span>Analyzing practice records and processing request...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && !pendingAction && (
          <div className="p-3 bg-white border-t border-slate-200">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Suggested Queries
            </span>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  className="text-[11px] p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-left transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          {errorMessage && (
            <div className="mb-2 text-xs text-rose-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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
                placeholder="Ask assistant to fetch records or manage profile..."
                maxLength={500}
                disabled={loading || Boolean(pendingAction)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
              <span className="absolute right-2.5 bottom-1 text-[9px] text-slate-400">
                {input.length}/500
              </span>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim() || Boolean(pendingAction)}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-3.5 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
