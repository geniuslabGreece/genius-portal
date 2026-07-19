import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bot, Send, Shield, User as UserIcon, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/portal/auth/AuthContext";
import {
  ticketDepartments,
  ticketStatusMeta,
  priorityMeta,
  formatTicketDate,
  TicketStatus,
  TicketPriority,
  TicketDepartment,
} from "@/portal/data/tickets";
import { cn } from "@/lib/utils";
import { SharePointWorklogsPanel } from "@/portal/components/SharePointWorklogsPanel";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["ticket-messages", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!reply.trim() || !ticket || !user) return;
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_user_id: user.id,
        author_type: isAdmin ? "admin" : "customer",
        body: reply.trim(),
        is_internal: isAdmin && isInternal,
      });
      if (error) throw error;
      // Update status if customer replies on waiting_customer
      if (!isAdmin && ticket.status === "waiting_customer") {
        await supabase.from("tickets").update({ status: "in_progress" }).eq("id", ticket.id);
      }
      if (!isInternal) {
        supabase.functions.invoke("notify-ticket", {
          body: { ticket_id: ticket.id, event: "reply" },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      setReply("");
      setIsInternal(false);
      qc.invalidateQueries({ queryKey: ["ticket-messages", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: TicketStatus) => {
      const patch: any = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("tickets").update(patch).eq("id", ticket!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Κατάσταση ενημερώθηκε");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  const updateField = useMutation({
    mutationFn: async (patch: Partial<{ status: TicketStatus; priority: TicketPriority; department: TicketDepartment }>) => {
      const { error } = await supabase.from("tickets").update(patch).eq("id", ticket!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ενημερώθηκε");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  if (isLoading) return <Card className="p-8 text-center text-muted-foreground">Φόρτωση…</Card>;
  if (!ticket) return <Card className="p-8 text-center">Δεν βρέθηκε ticket.</Card>;

  const status = ticketStatusMeta[ticket.status as TicketStatus];
  const dept = ticketDepartments.find((d) => d.value === ticket.department);
  const visibleMessages = isAdmin ? messages : messages.filter((m: any) => !m.is_internal);

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(isAdmin ? "/portal/admin?tab=tickets" : "/portal/support")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Πίσω
      </button>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">Ticket #{ticket.ticket_number}</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{ticket.subject}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Δημιουργήθηκε {formatTicketDate(ticket.created_at)} • {dept?.label ?? ticket.department}
            </p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", status.className)}>
            {status.label}
          </span>
        </div>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
              <Select value={ticket.status} onValueChange={(v) => updateField.mutate({ status: v as TicketStatus })}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ticketStatusMeta).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Τμήμα</label>
              <Select value={ticket.department} onValueChange={(v) => updateField.mutate({ department: v as TicketDepartment })}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ticketDepartments.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Προτεραιότητα</label>
              <Select value={ticket.priority} onValueChange={(v) => updateField.mutate({ priority: v as TicketPriority })}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityMeta).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ticket.status !== "resolved" && (
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={() => updateStatus.mutate("resolved")}
              >
                Σήμανση ως Επιλύθηκε
              </Button>
            )}
            {(ticket.status === "resolved" || ticket.status === "closed") && (
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={() => updateStatus.mutate("open")}
              >
                Άνοιγμα ξανά
              </Button>
            )}
            {ticket.status !== "closed" && (
              <Button
                size="sm"
                variant="ghost"
                className="self-end text-muted-foreground"
                onClick={() => updateStatus.mutate("closed")}
              >
                Κλείσιμο
              </Button>
            )}
          </div>
        )}

        {ticket.ai_chat_summary && (
          <details className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-muted-foreground">
              <Bot className="mr-1 inline h-3.5 w-3.5" /> Συνομιλία με AI Bot πριν το ticket
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-foreground/80">{ticket.ai_chat_summary}</pre>
          </details>
        )}
      </Card>

      <Card className="p-4">
        <div className="space-y-3">
          {visibleMessages.map((m: any) => {
            const isAdminMsg = m.author_type === "admin";
            const isBot = m.author_type === "ai_bot";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3",
                  isAdminMsg ? "justify-start" : "justify-end",
                )}
              >
                {isAdminMsg && (
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5",
                    m.is_internal
                      ? "border border-amber-500/40 bg-amber-500/10 text-foreground"
                      : isAdminMsg
                        ? "bg-muted text-foreground"
                        : isBot
                          ? "bg-accent/10 text-foreground"
                          : "bg-primary text-primary-foreground",
                  )}
                >
                  {m.is_internal && (
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      <Lock className="h-3 w-3" /> Εσωτερική σημείωση
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <p className={cn("mt-1.5 text-[10px] opacity-70")}>
                    {formatTicketDate(m.created_at)}
                  </p>
                </div>
                {!isAdminMsg && (
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {ticket.status !== "closed" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendReply.mutate();
            }}
            className="mt-4 space-y-2 border-t border-border pt-4"
          >
            <Textarea
              rows={3}
              placeholder={isAdmin ? "Απάντηση προς πελάτη…" : "Γράψτε την απάντησή σας…"}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex items-center justify-between">
              {isAdmin ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  Εσωτερική σημείωση (δεν φαίνεται στον πελάτη)
                </label>
              ) : <span />}
              <Button type="submit" disabled={!reply.trim() || sendReply.isPending}>
                <Send className="mr-1.5 h-4 w-4" /> Αποστολή
              </Button>
            </div>
          </form>
        )}
      </Card>

      {ticket.customer_id && (
        <SharePointWorklogsPanel customerId={ticket.customer_id} />
      )}
    </div>
  );
}