import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, ShieldCheck, X, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions, NO_PERMISSION_MESSAGE } from "@/portal/auth/permissions";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

interface AssignmentRow {
  id: string;
  user_id: string;
  customer_id: string;
}

/**
 * Many-to-many διαχείριση: ανάθεση/αφαίρεση customer_admin πρόσβασης
 * ενός χρήστη σε πολλαπλές εταιρείες μέσω του πίνακα user_customer_admins.
 */
export function CustomerAdminAssignments() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const allowed = can("users.change_role");
  const [search, setSearch] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["all-users-admin-assign"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");
      if (error) throw error;
      const ids = (profiles ?? []).map((p: any) => p.id);
      const { data: roleRows } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as any[] };
      const rolesMap = new Map<string, string[]>();
      (roleRows ?? []).forEach((r: any) => {
        rolesMap.set(r.user_id, [...(rolesMap.get(r.user_id) ?? []), r.role]);
      });
      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        roles: rolesMap.get(p.id) ?? [],
      }));
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["user-customer-admins"],
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from("user_customer_admins")
        .select("id, user_id, customer_id");
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  const assignmentsByUser = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    assignments.forEach((a) => {
      map.set(a.user_id, [...(map.get(a.user_id) ?? []), a]);
    });
    return map;
  }, [assignments]);

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id;

  const addAssignment = useMutation({
    mutationFn: async (vars: { userId: string; customerId: string }) => {
      // Ensure user has customer_admin role
      const user = users.find((u) => u.id === vars.userId);
      if (user && !user.roles.includes("customer_admin") && !user.roles.includes("admin")) {
        const { error: rErr } = await supabase
          .from("user_roles")
          .insert({ user_id: vars.userId, role: "customer_admin" });
        if (rErr) throw rErr;
      }
      const { error } = await supabase
        .from("user_customer_admins")
        .insert({ user_id: vars.userId, customer_id: vars.customerId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Η εταιρεία ανατέθηκε");
      qc.invalidateQueries({ queryKey: ["user-customer-admins"] });
      qc.invalidateQueries({ queryKey: ["all-users-admin-assign"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_customer_admins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Η ανάθεση αφαιρέθηκε");
      qc.invalidateQueries({ queryKey: ["user-customer-admins"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Customer Admin — Πολλαπλές εταιρείες</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Αναθέστε σε χρήστες δικαιώματα customer admin για μία ή περισσότερες εταιρείες.
          Ο ρόλος <code className="rounded bg-muted px-1 py-0.5 text-[10px]">customer_admin</code> προστίθεται αυτόματα όταν γίνει η πρώτη ανάθεση.
        </p>
      </div>

      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση email ή ονόματος…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} χρήστες</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Χρήστης</th>
              <th className="px-4 py-3 font-semibold">Εταιρείες ως admin</th>
              <th className="px-4 py-3 font-semibold text-right">Προσθήκη</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usersLoading && (
              <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Φόρτωση…</td></tr>
            )}
            {!usersLoading && filtered.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Δεν βρέθηκαν χρήστες.</td></tr>
            )}
            {filtered.map((u) => {
              const userAssignments = assignmentsByUser.get(u.id) ?? [];
              const assignedIds = new Set(userAssignments.map((a) => a.customer_id));
              const available = customers.filter((c) => !assignedIds.has(c.id));
              const isPortalAdmin = u.roles.includes("admin");
              return (
                <tr key={u.id} className="align-top transition hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {isPortalAdmin && (
                      <span className="mt-1 inline-block rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-semibold text-brand-red">
                        Portal admin (καθολική πρόσβαση)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {userAssignments.length === 0 ? (
                      <span className="text-xs text-muted-foreground">— καμία —</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {userAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            <Building2 className="h-3 w-3" />
                            {customerName(a.customer_id)}
                            <button
                              type="button"
                              disabled={!allowed}
                              onClick={() => {
                                if (!allowed) { toast.error(NO_PERMISSION_MESSAGE); return; }
                                if (confirm(`Αφαίρεση πρόσβασης σε "${customerName(a.customer_id)}";`)) {
                                  removeAssignment.mutate(a.id);
                                }
                              }}
                              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 disabled:opacity-50"
                              title="Αφαίρεση"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!allowed || available.length === 0}
                          title={!allowed ? NO_PERMISSION_MESSAGE : available.length === 0 ? "Όλες οι εταιρείες έχουν ανατεθεί" : "Προσθήκη εταιρείας"}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Εταιρεία
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-2">
                        <AddCompanySelect
                          options={available}
                          onSelect={(cid) => addAssignment.mutate({ userId: u.id, customerId: cid })}
                        />
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AddCompanySelect({
  options,
  onSelect,
}: {
  options: { id: string; name: string }[];
  onSelect: (id: string) => void;
}) {
  const [value, setValue] = useState<string>("");
  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger><SelectValue placeholder="Επιλέξτε εταιρεία…" /></SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        className="w-full"
        size="sm"
        disabled={!value}
        onClick={() => { onSelect(value); setValue(""); }}
      >
        Ανάθεση
      </Button>
    </div>
  );
}