import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, Plus, X, Loader2, ShieldCheck, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, NO_PERMISSION_MESSAGE } from "@/portal/auth/permissions";

type Role = "admin" | "customer_admin" | "customer_user";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Portal Admin",
  customer_admin: "Customer Admin",
  customer_user: "Customer User",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-brand-red/10 text-brand-red border-brand-red/30",
  customer_admin: "bg-primary/10 text-primary border-primary/30",
  customer_user: "bg-muted text-foreground/70 border-border",
};

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  customer_id: string | null;
}

interface CustomerRow {
  id: string;
  name: string;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });

function CustomerAssign({
  userId,
  currentId,
  customers,
  disabled,
  onAssign,
  pending,
}: {
  userId: string;
  currentId: string | null;
  customers: CustomerRow[];
  disabled: boolean;
  onAssign: (userId: string, customerId: string | null) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = customers.find((c) => c.id === currentId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          disabled={disabled}
          className="h-8 w-56 justify-start gap-2 truncate"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-xs">
            {current?.name ?? "— Χωρίς εταιρεία —"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Αναζήτηση εταιρείας…" />
          <CommandList>
            <CommandEmpty>Δεν βρέθηκε εταιρεία.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onAssign(userId, null);
                  setOpen(false);
                }}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Χωρίς εταιρεία
              </CommandItem>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.id}`}
                  onSelect={() => {
                    onAssign(userId, c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${c.id === currentId ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export function UserRolesPanel() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const allowed = can("users.change_role");
  const [search, setSearch] = useState("");
  const [addRoleFor, setAddRoleFor] = useState<Record<string, Role>>({});

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["roles-panel-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["roles-panel-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, RoleRow[]>();
    allRoles.forEach((r) => {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r);
      m.set(r.user_id, arr);
    });
    return m;
  }, [allRoles]);

  const addRole = useMutation({
    mutationFn: async (vars: { userId: string; role: Role }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: vars.userId, role: vars.role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ρόλος προστέθηκε");
      qc.invalidateQueries({ queryKey: ["roles-panel-roles"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ρόλος αφαιρέθηκε");
      qc.invalidateQueries({ queryKey: ["roles-panel-roles"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return p.email.toLowerCase().includes(q) || (p.full_name ?? "").toLowerCase().includes(q);
  });

  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-border p-4">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Διαχείριση ρόλων χρηστών</h3>
          <p className="text-xs text-muted-foreground">
            Ανάθεση/αφαίρεση πολλαπλών ρόλων ανά χρήστη με ορατή την ημερομηνία απόδοσης.
          </p>
        </div>
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
              <th className="px-4 py-3 font-semibold">Ρόλοι (με ημ/νία)</th>
              <th className="px-4 py-3 font-semibold text-right">Προσθήκη ρόλου</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  Φόρτωση…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  Δεν βρέθηκαν χρήστες.
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const userRoles = rolesByUser.get(u.id) ?? [];
              const availableRoles = (["admin", "customer_admin", "customer_user"] as Role[]).filter(
                (r) => !userRoles.some((ur) => ur.role === r),
              );
              const selected = addRoleFor[u.id] ?? availableRoles[0];
              return (
                <tr key={u.id} className="align-top transition hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {userRoles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">— Κανένας ρόλος —</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {userRoles
                          .slice()
                          .sort((a, b) => a.created_at.localeCompare(b.created_at))
                          .map((r) => (
                            <Badge
                              key={r.id}
                              variant="outline"
                              className={`gap-1.5 ${ROLE_COLOR[r.role]}`}
                            >
                              <span className="font-medium">{ROLE_LABEL[r.role]}</span>
                              <span className="text-[10px] opacity-70">
                                · {formatDate(r.created_at)}
                              </span>
                              {allowed && (
                                <button
                                  type="button"
                                  className="ml-0.5 rounded-full hover:bg-foreground/10"
                                  onClick={() => {
                                    if (confirm(`Αφαίρεση του ρόλου "${ROLE_LABEL[r.role]}";`)) {
                                      removeRole.mutate(r.id);
                                    }
                                  }}
                                  title="Αφαίρεση"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {availableRoles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Όλοι ανατέθηκαν</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={selected}
                          onValueChange={(v) =>
                            setAddRoleFor((s) => ({ ...s, [u.id]: v as Role }))
                          }
                          disabled={!allowed}
                        >
                          <SelectTrigger className="h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !allowed ||
                            (addRole.isPending &&
                              addRole.variables?.userId === u.id)
                          }
                          onClick={() => {
                            if (!allowed) {
                              toast.error(NO_PERMISSION_MESSAGE);
                              return;
                            }
                            addRole.mutate({ userId: u.id, role: selected });
                          }}
                        >
                          {addRole.isPending && addRole.variables?.userId === u.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
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
