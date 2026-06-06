import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, Users2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  customerId: string;
}

type AppRole = "admin" | "customer_admin" | "customer_user";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Διαχειριστής συστήματος",
  customer_admin: "Διαχειριστής εταιρείας",
  customer_user: "Χρήστης",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-brand-red/10 text-brand-red",
  customer_admin: "bg-primary/10 text-primary",
  customer_user: "bg-muted text-muted-foreground",
};

export default function AzureGroupRoleMappings({ customerId }: Props) {
  const qc = useQueryClient();
  const [draftGroup, setDraftGroup] = useState<string>("");
  const [draftRole, setDraftRole] = useState<AppRole>("customer_user");

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["azure-ad-groups", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_groups")
        .select("azure_group_id, display_name, member_count, security_enabled")
        .eq("customer_id", customerId)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ["azure-role-mappings", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_role_mappings")
        .select("id, azure_group_id, azure_group_name, role, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!draftGroup) throw new Error("Επιλέξτε group");
      const g = groups.find((x) => x.azure_group_id === draftGroup);
      const { error } = await supabase.from("customer_azure_ad_role_mappings").insert({
        customer_id: customerId,
        azure_group_id: draftGroup,
        azure_group_name: g?.display_name ?? null,
        role: draftRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapping προστέθηκε");
      setDraftGroup("");
      qc.invalidateQueries({ queryKey: ["azure-role-mappings", customerId] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_azure_ad_role_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Διαγράφηκε");
      qc.invalidateQueries({ queryKey: ["azure-role-mappings", customerId] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Όταν τρέχει ο συγχρονισμός, οι χρήστες που ανήκουν σε αυτά τα Azure AD groups
        παίρνουν αυτόματα τον αντίστοιχο ρόλο στο portal (matching γίνεται με βάση το email).
        Απαιτείται επιπλέον Microsoft Graph permission: <code>Group.Read.All</code>.
      </div>

      {/* Add new mapping */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <div className="flex-1 min-w-[240px] space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Azure AD group
          </label>
          <Select value={draftGroup} onValueChange={setDraftGroup}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  groupsLoading
                    ? "Φόρτωση…"
                    : groups.length === 0
                    ? "Δεν υπάρχουν groups — εκτελέστε «Συγχρονισμός»"
                    : "Επιλέξτε group"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.azure_group_id} value={g.azure_group_id}>
                  <span className="flex items-center gap-2">
                    <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {g.display_name ?? g.azure_group_id}
                    <span className="text-[10px] text-muted-foreground">({g.member_count})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ρόλος portal
          </label>
          <Select value={draftRole} onValueChange={(v) => setDraftRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer_user">{ROLE_LABEL.customer_user}</SelectItem>
              <SelectItem value="customer_admin">{ROLE_LABEL.customer_admin}</SelectItem>
              <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !draftGroup}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Προσθήκη
        </Button>
      </div>

      {/* Existing mappings */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Azure AD group</th>
              <th className="px-3 py-2 font-semibold">Ρόλος portal</th>
              <th className="px-3 py-2 font-semibold">Ενεργοποιήθηκε</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mappingsLoading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Φόρτωση…
                </td>
              </tr>
            )}
            {!mappingsLoading && mappings.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Καμία αντιστοίχιση. Προσθέστε μία από πάνω.
                </td>
              </tr>
            )}
            {mappings.map((m: any) => {
              const g = groups.find((x) => x.azure_group_id === m.azure_group_id);
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {g?.display_name ?? m.azure_group_name ?? m.azure_group_id}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {m.azure_group_id}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={`gap-1 ${ROLE_BADGE[m.role as AppRole]}`}>
                      <ShieldCheck className="h-3 w-3" />
                      {ROLE_LABEL[m.role as AppRole]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("el-GR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(m.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-brand-red" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
