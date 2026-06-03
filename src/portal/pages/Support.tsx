import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, LifeBuoy, Plus, Send, Sparkles, Ticket, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/portal/auth/AuthContext";
import {
  TicketDepartment,
  TicketPriority,
  ticketDepartments,
  ticketStatusMeta,
  priorityMeta,
  formatTicketDate,
} from "@/portal/data/tickets";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function Support() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Tickets list
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", profile?.customer_id],
    enabled: !!profile?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── New ticket form
  const [newOpen, setNewOpen] = useState(false);
  const [department, setDepartment] = useState<TicketDepartment>("technical");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!profile?.customer_id || !user) throw new Error("Δεν έχετε ανατεθεί σε εταιρεία.");
      if (!subject.trim() || !description.trim()) throw new Error("Συμπληρώστε θέμα και περιγραφή.");
      const { data: t, error } = await supabase
        .from("tickets")
        .insert({
          customer_id: profile.customer_id,
          created_by: user.id,
          department,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          ai_chat_summary: chatSummary || null,
        })
        .select()
        .single();
      if (error) throw error;
      // First message = description
      await supabase.from("ticket_messages").insert({
        ticket_id: t.id,
        author_user_id: user.id,
        author_type: "customer",
        body: description.trim(),
      });
      // Notify (best-effort)
      supabase.functions.invoke("notify-ticket", {
        body: { ticket_id: t.id, event: "created" },
      }).catch(() => {});
      return t;
    },
    onSuccess: (t) => {
      toast.success(`Ticket #${t.ticket_number} δημιουργήθηκε`);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setNewOpen(false);
      setSubject("");
      setDescription("");
      setPriority("normal");
      setChatSummary("");
      navigate(`/portal/support/${t.id}`);
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  // ── AI bot
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSummary, setChatSummary] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const next: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat(next);
    setChatInput("");
    setChatLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (resp.status === 429) {
        toast.error("Πολλά αιτήματα — δοκιμάστε ξανά σε λίγο.");
        setChatLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Εξαντλήθηκαν τα credits AI.");
        setChatLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Αποτυχία AI");

      // Append empty assistant message
      setChat((c) => [...c, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accum = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              accum += delta;
              setChat((c) => {
                const copy = [...c];
                copy[copy.length - 1] = { role: "assistant", content: accum };
                return copy;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      setChatSummary(accum.slice(0, 500));
    } catch (e: any) {
      toast.error(e.message ?? "Σφάλμα");
    } finally {
      setChatLoading(false);
    }
  };

  const escalateToTicket = () => {
    if (chat.length === 0) {
      setNewOpen(true);
      return;
    }
    // Pre-fill description from chat
    const lastUser = [...chat].reverse().find((m) => m.role === "user");
    setSubject(lastUser?.content.slice(0, 80) ?? "Αίτημα από AI Chat");
    const transcript = chat.map((m) => `${m.role === "user" ? "Πελάτης" : "AI Bot"}: ${m.content}`).join("\n\n");
    setDescription(transcript);
    setNewOpen(true);
  };

  const ticketsByStatus = useMemo(() => {
    const open = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status));
    const closed = tickets.filter((t: any) => ["resolved", "closed"].includes(t.status));
    return { open, closed };
  }, [tickets]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Υποστήριξη</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Κέντρο Υποστήριξης</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ρωτήστε τον AI βοηθό μας για άμεσες απαντήσεις, ή ανοίξτε ticket στο σωστό τμήμα.
        </p>
      </div>

      <Tabs defaultValue="bot">
        <TabsList>
          <TabsTrigger value="bot">
            <Bot className="mr-1.5 h-4 w-4" /> AI Βοηθός
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="mr-1.5 h-4 w-4" /> Νέο Ticket
          </TabsTrigger>
          <TabsTrigger value="list">
            <Ticket className="mr-1.5 h-4 w-4" /> Τα tickets μου
          </TabsTrigger>
        </TabsList>

        {/* AI BOT TAB */}
        <TabsContent value="bot" className="mt-4">
          <Card className="flex h-[600px] flex-col">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">GeniusNet AI Βοηθός</p>
                  <p className="text-xs text-muted-foreground">Άμεσες απαντήσεις 24/7</p>
                </div>
              </div>
              {chat.length > 0 && (
                <Button size="sm" variant="outline" onClick={escalateToTicket}>
                  <LifeBuoy className="mr-1.5 h-4 w-4" />
                  Άνοιγμα Ticket
                </Button>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chat.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <Bot className="mb-3 h-10 w-10 opacity-40" />
                  <p>Ξεκινήστε μια συζήτηση με τον AI βοηθό.</p>
                  <p className="mt-1 text-xs">Π.χ. «Πώς ανανεώνω άδεια Microsoft 365;»</p>
                </div>
              )}
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content || <span className="opacity-50">…</span>}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Γράψτε το ερώτημά σας…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <Button type="submit" disabled={chatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </TabsContent>

        {/* NEW TICKET TAB */}
        <TabsContent value="new" className="mt-4">
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold">Άνοιγμα νέου ticket</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Επιλέξτε τμήμα και περιγράψτε το αίτημά σας. Θα δρομολογηθεί στους αρμόδιους.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTicket.mutate();
              }}
              className="mt-6 grid gap-4 md:grid-cols-2"
            >
              <div>
                <Label>Τμήμα *</Label>
                <Select value={department} onValueChange={(v) => setDepartment(v as TicketDepartment)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ticketDepartments.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticketDepartments.find((d) => d.value === department)?.description}
                </p>
              </div>
              <div>
                <Label>Προτεραιότητα</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityMeta).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Θέμα *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
              </div>
              <div className="md:col-span-2">
                <Label>Περιγραφή *</Label>
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Περιγράψτε το πρόβλημα ή το αίτημα όσο πιο αναλυτικά μπορείτε…"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? "Αποστολή…" : "Άνοιγμα Ticket"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        {/* LIST TAB */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {isLoading && <Card className="p-8 text-center text-muted-foreground">Φόρτωση…</Card>}
          {!isLoading && tickets.length === 0 && (
            <Card className="p-8 text-center">
              <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Δεν έχετε υποβάλει ακόμα κανένα ticket.</p>
            </Card>
          )}

          {ticketsByStatus.open.length > 0 && (
            <Card>
              <div className="border-b border-border p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ενεργά ({ticketsByStatus.open.length})
              </div>
              <ul className="divide-y divide-border">
                {ticketsByStatus.open.map((t: any) => (
                  <TicketRow key={t.id} t={t} onClick={() => navigate(`/portal/support/${t.id}`)} />
                ))}
              </ul>
            </Card>
          )}
          {ticketsByStatus.closed.length > 0 && (
            <Card>
              <div className="border-b border-border p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Κλειστά ({ticketsByStatus.closed.length})
              </div>
              <ul className="divide-y divide-border">
                {ticketsByStatus.closed.map((t: any) => (
                  <TicketRow key={t.id} t={t} onClick={() => navigate(`/portal/support/${t.id}`)} />
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TicketRow({ t, onClick }: { t: any; onClick: () => void }) {
  const status = ticketStatusMeta[t.status as keyof typeof ticketStatusMeta];
  const dept = ticketDepartments.find((d) => d.value === t.department);
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-muted/50"
      >
        <span className="font-mono text-xs text-muted-foreground">#{t.ticket_number}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{t.subject}</p>
          <p className="text-xs text-muted-foreground">
            {dept?.label ?? t.department} • {formatTicketDate(t.created_at)}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", status.className)}>
          {status.label}
        </span>
      </button>
    </li>
  );
}