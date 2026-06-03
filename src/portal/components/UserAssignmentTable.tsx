import { useState } from "react";
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
import { Search, Shield, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { usePermissions, NO_PERMISSION_MESSAGE } from "@/portal/auth/permissions";

interface Props {
  /** If set, restricts assignment to a single customer (used inside CustomerDetail). */
  lockedCustomerId?: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  role: "admin" | "customer_admin" | "customer_user";
}

export function UserAssignmentTable({ lockedCustomerId }: Props) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users", lockedCustomerId ?? "all"],
    queryFn: async (): Promise<UserRow[]> => {
      let q = supabase
        .from("profiles")
        .select("id, email, full_name, customer_id, customers(name)")
        .order("email");
      if (lockedCustomerId) q = q.eq("customer_id", lockedCustomerId);
      const { data: profiles, error } = await q;
      if (error) throw error;

      const ids = (profiles ?? []).map((p: any) => p.id);
      const { data: rolesRows } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as any[] };

      const roleMap = new Map<string, UserRow["role"]>();
      (rolesRows ?? []).forEach((r: any) => {
        // priority admin > customer_admin > customer_user
        const cur = roleMap.get(r.user_id);
        const order = { admin: 3, customer_admin: 2, customer_user: 1 } as const;
        if (!cur || order[r.role as keyof typeof order] > order[cur]) roleMap.set(r.user_id, r.role);
      });

      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        customer_id: p.customer_id,
        customer_name: p.customers?.name ?? null,
        role: roleMap.get(p.id) ?? "customer_user",
      }));
    },
  });

  const assignCustomer = useMutation({
    mutationFn: async (vars: { userId: string; customerId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ customer_id: vars.customerId })
        .eq("id", vars.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ανατέθηκε");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const setRole = useMutation({
    mutationFn: async (vars: { userId: string; role: UserRow["role"] }) => {
      // remove all roles for this user, then insert the new one (single role per user model)
      await supabase.from("user_roles").delete().eq("user_id", vars.userId);
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: vars.userId, role: vars.role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ρόλος ενημερώθηκε");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return email;
    },
    onSuccess: (email) => {
      toast.success("Email εστάλη", {
        description: `Σύνδεσμος επαναφοράς κωδικού στάλθηκε στο ${email}.`,
      });
    },
    onError: (e: any) => toast.error("Αποτυχία αποστολής", { description: e.message }),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.customer_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      {!can("users.assign_customer") && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-800">
          <Lock className="h-3.5 w-3.5" />
          Λειτουργία ανάγνωσης μόνο. Απαιτείται ρόλος Portal Admin για ανάθεση εταιρείας, αλλαγή ρόλου και reset password.
        </div>
      )}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση email, ονόματος ή πελάτη…"
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
              <th className="px-4 py-3 font-semibold">Πελάτης</th>
              <th className="px-4 py-3 font-semibold">Ρόλος</th>
              <th className="px-4 py-3 font-semibold text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Φόρτωση…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Δεν βρέθηκαν χρήστες.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="transition hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.role === "admin" ? (
                      <Shield className="h-4 w-4 text-brand-red" />
                    ) : (
                      <ShieldOff className="h-4 w-4 text-muted-foreground/60" />
                    )}
                    <div>
                      <div className="font-medium text-foreground">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.customer_id ?? "none"}
                    onValueChange={(v) =>
                      assignCustomer.mutate({
                        userId: u.id,
                        customerId: v === "none" ? null : v,
                      })
                    }
                    disabled={!!lockedCustomerId || !can("users.assign_customer")}
                  >
                    <SelectTrigger className="h-8 w-56">
                      <SelectValue placeholder="— Καμία ανάθεση —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Καμία ανάθεση —</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.role}
                    onValueChange={(v) => {
                      if (!can("users.change_role")) {
                        toast.error(NO_PERMISSION_MESSAGE);
                        return;
                      }
                      setRole.mutate({ userId: u.id, role: v as UserRow["role"] });
                    }}
                    disabled={!can("users.change_role")}
                  >
                    <SelectTrigger className={cn("h-8 w-44", u.role === "admin" && "border-brand-red/40 text-brand-red")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_user">Customer user</SelectItem>
                      <SelectItem value="customer_admin">Customer admin</SelectItem>
                      <SelectItem value="admin">Portal admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-accent"
                    disabled={
                      !can("users.reset_password") ||
                      (resetPassword.isPending && resetPassword.variables === u.email)
                    }
                    title={can("users.reset_password") ? "Αποστολή email reset" : NO_PERMISSION_MESSAGE}
                    onClick={() => {
                      if (!can("users.reset_password")) {
                        toast.error(NO_PERMISSION_MESSAGE);
                        return;
                      }
                      if (confirm(`Αποστολή email επαναφοράς κωδικού στο ${u.email};`)) {
                        resetPassword.mutate(u.email);
                      }
                    }}
                  >
                    {resetPassword.isPending && resetPassword.variables === u.email ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Reset password
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
