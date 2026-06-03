import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Trash2, Loader2, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "portal:assistant:messages:v1";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/ai-assistant`;

function loadInitial(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "Ποια συμβόλαια λήγουν τους επόμενους 2 μήνες;",
  "Πόσες Microsoft 365 / Copilot άδειες έχουμε και πόσες χρησιμοποιούνται;",
  "Δείξε μου τις μη συμμορφούμενες (non-compliant) συσκευές.",
  "Ποια ανοιχτά tickets υποστήριξης υπάρχουν;",
];

export default function Assistant() {
  const [initial] = useState<UIMessage[]>(() => loadInitial());
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Custom fetch that injects the Supabase JWT for streaming POSTs.
  const transport = new DefaultChatTransport({
    api: FN_URL,
    fetch: async (url, init) => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
      return fetch(url, { ...init, headers });
    },
  });

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: "portal-assistant",
    messages: initial,
    transport,
  });

  // Persist locally
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* noop */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Keep textarea focused
  useEffect(() => { taRef.current?.focus(); }, [status]);

  const isLoading = status === "submitted" || status === "streaming";

  const onSend = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || isLoading) return;
    setInput("");
    await sendMessage({ text: t });
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-soft">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">AI Σύμβουλος</h1>
            <p className="text-sm text-muted-foreground">
              Ρωτήστε για τα συμβόλαια, τις άδειες, τις συσκευές, το Copilot και τα tickets σας. Οι απαντήσεις βασίζονται στα πραγματικά δεδομένα της εταιρείας σας.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4" />
            Καθαρισμός
          </Button>
        )}
      </header>

      <Card className="flex h-[calc(100vh-260px)] min-h-[480px] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center">
              <div className="max-w-md space-y-4 text-center">
                <p className="text-sm text-muted-foreground">Δοκιμάστε:</p>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSend(s)}
                      className="rounded-lg border border-border bg-card px-4 py-2.5 text-left text-sm transition hover:border-primary/40 hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Σκέφτεται...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Σφάλμα: {error.message}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 p-4">
          <div className="flex gap-2">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Γράψτε την ερώτησή σας..."
              rows={2}
              className="min-h-[60px] flex-1 resize-none"
              disabled={isLoading}
            />
            <Button onClick={() => onSend()} disabled={isLoading || !input.trim()} size="lg" className="self-end">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Powered by Gemini · Τα δεδομένα παραμένουν στο πλαίσιο της εταιρείας σας.
          </p>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter((p: any) => p.type === "text") as Array<{ type: "text"; text: string }>;
  const toolParts = message.parts.filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-")) as any[];
  const text = textParts.map((p) => p.text).join("");

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
          <Sparkles className="h-4 w-4" />
        </span>
      )}
      <div className={cn("max-w-[80%] space-y-2", isUser && "flex flex-col items-end")}>
        {toolParts.length > 0 && (
          <div className="space-y-1">
            {toolParts.map((tp, i) => (
              <Badge key={i} variant="outline" className="gap-1 text-[10px]">
                <Wrench className="h-3 w-3" />
                {String(tp.type).replace(/^tool-/, "")}
                {tp.state === "output-available" ? " ✓" : tp.state === "input-streaming" || tp.state === "input-available" ? " ..." : ""}
              </Badge>
            ))}
          </div>
        )}
        {text && (
          <div
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-foreground",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{text}</p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-pre:text-xs">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}