import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Mail, Trash2, CheckCircle2, XCircle, RotateCcw, Inbox, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ticketDepartments,
  ticketStatusMeta,
  priorityMeta,
  formatTicketDate,
  TicketDepartment,
  TicketStatus,
  TicketPriority,
} from "@/portal/data/tickets";
import { cn } from "@/lib/utils";

export function AdminTicketsPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<TicketDepartment | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: refresh when tickets change
  useEffect(() => {
    const ch = supabase
      .channel("admin-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: deptSettings = [] } = useQuery({
    queryKey: ["ticket-dept-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_department_settings").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateDept = useMutation({
    mutationFn: async ({ department, notify_email }: { department: TicketDepartment; notify_email: string }) => {
      const { error } = await supabase
        .from("ticket_department_settings")
        .update({ notify_email: notify_email || null })
        .eq("department", department);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email τμήματος ενημερώθηκε");
      qc.invalidateQueries({ queryKey: ["ticket-dept-settings"] });
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (patch: Partial<{ status: TicketStatus; department: TicketDepartment; priority: TicketPriority }>) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const finalPatch: any = { ...patch };
      if (patch.status === "resolved") finalPatch.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("tickets").update(finalPatch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ενημερώθηκε");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const { error } = await supabase.from("tickets").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Διαγράφηκαν");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => toast.error("Αποτυχία", { description: e.message }),
  });

  const filtered = tickets.filter((t: any) => {
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q) ||
        (t.customers?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = useMemo(() => {
    const open = tickets.filter((t: any) => t.status === "open").length;
    const inProgress = tickets.filter((t: any) => t.status === "in_progress").length;
    const waiting = tickets.filter((t: any) => t.status === "waiting_customer").length;
    const urgent = tickets.filter((t: any) => t.priority === "urgent" && !["resolved", "closed"].includes(t.status)).length;
    return { open, inProgress, waiting, urgent, total: tickets.length };
  }, [tickets]);

  const allOnPageSelected = filtered.length > 0 && filtered.every((t: any) => selected.has(t.id));
  const toggleAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      filtered.forEach((t: any) => next.delete(t.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((t: any) => next.add(t.id));
      setSelected(next);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Νέα" value={stats.open} icon={Inbox} className="text-amber-700 bg-amber-500/10" />
        <StatCard label="Σε εξέλιξη" value={stats.inProgress} icon={Clock} className="text-blue-700 bg-blue-500/10" />
        <StatCard label="Αναμονή πελάτη" value={stats.waiting} icon={RotateCcw} className="text-purple-700 bg-purple-500/10" />
        <StatCard label="Επείγοντα ανοιχτά" value={stats.urgent} icon={AlertCircle} className="text-red-700 bg-red-500/10" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Αναζήτηση: αρ., θέμα, πελάτης…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλα τα τμήματα</SelectItem>
              {ticketDepartments.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
              {Object.entries(ticketStatusMeta).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι προτ.</SelectItem>
              {Object.entries(priorityMeta).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} tickets</span>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <span className="text-xs font-semibold">{selected.size} επιλεγμένα</span>
            <Select onValueChange={(v) => bulkUpdate.mutate({ status: v as TicketStatus })}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Αλλαγή status…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ticketStatusMeta).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate.mutate({ department: v as TicketDepartment })}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Αλλαγή τμήματος…" /></SelectTrigger>
              <SelectContent>
                {ticketDepartments.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate.mutate({ priority: v as TicketPriority })}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Προτεραιότητα…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(priorityMeta).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ status: "resolved" })}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Επίλυση
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ status: "closed" })}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Κλείσιμο
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (confirm(`Διαγραφή ${selected.size} tickets;`)) bulkDelete.mutate();
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Διαγραφή
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Καθαρισμός</Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Θέμα</th>
                <th className="px-4 py-3 font-semibold">Πελάτης</th>
                <th className="px-4 py-3 font-semibold">Τμήμα</th>
                <th className="px-4 py-3 font-semibold">Προτ.</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Ημερομηνία</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Φόρτωση…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Δεν βρέθηκαν tickets.</td></tr>
              )}
              {filtered.map((t: any) => {
                const status = ticketStatusMeta[t.status as TicketStatus];
                const prio = priorityMeta[t.priority as keyof typeof priorityMeta];
                const dept = ticketDepartments.find((d) => d.value === t.department);
                const isSel = selected.has(t.id);
                return (
                  <tr
                    key={t.id}
                    className={cn("transition hover:bg-muted/30", isSel && "bg-primary/5")}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => {
                          const next = new Set(selected);
                          if (isSel) next.delete(t.id); else next.add(t.id);
                          setSelected(next);
                        }}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="cursor-pointer px-4 py-3 font-mono text-xs text-muted-foreground" onClick={() => navigate(`/portal/support/${t.id}`)}>#{t.ticket_number}</td>
                    <td className="cursor-pointer px-4 py-3 font-medium" onClick={() => navigate(`/portal/support/${t.id}`)}>{t.subject}</td>
                    <td className="cursor-pointer px-4 py-3 text-muted-foreground" onClick={() => navigate(`/portal/support/${t.id}`)}>{t.customers?.name ?? "—"}</td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => navigate(`/portal/support/${t.id}`)}>{dept?.label ?? t.department}</td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => navigate(`/portal/support/${t.id}`)}>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", prio.className)}>
                        {prio.label}
                      </span>
                    </td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => navigate(`/portal/support/${t.id}`)}>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="cursor-pointer px-4 py-3 text-xs text-muted-foreground" onClick={() => navigate(`/portal/support/${t.id}`)}>{formatTicketDate(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Email Δρομολόγησης ανά τμήμα</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Όταν ανοίγει νέο ticket, ειδοποιείται το email του αντίστοιχου τμήματος (in-app πάντα, email όταν είναι ενεργοποιημένο το email infrastructure).
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {deptSettings.map((d: any) => (
            <div key={d.department} className="rounded-md border border-border p-3">
              <Label className="text-xs">{d.display_name}</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  defaultValue={d.notify_email ?? ""}
                  placeholder="email@geniusnet.gr"
                  type="email"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (d.notify_email ?? "")) {
                      updateDept.mutate({ department: d.department, notify_email: val });
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, className,
}: { label: string; value: number; icon: any; className: string }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span className={cn("grid h-11 w-11 place-items-center rounded-xl", className)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}