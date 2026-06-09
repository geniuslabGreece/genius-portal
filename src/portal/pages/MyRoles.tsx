import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Cloud, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/portal/auth/AuthContext";

const roleLabel: Record<string, string> = {
  admin: "Διαχειριστής",
  customer_admin: "Διαχειριστής Εταιρείας",
  customer_user: "Χρήστης",
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("el-GR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function MyRoles() {
  const { user, profile } = useAuth();

  // Roles with created_at (when granted)
  const { data: roleRows = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["my-role-rows", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Find Azure AD user record matching this email
  const { data: azureUser } = useQuery({
    queryKey: ["my-azure-user", profile?.email, profile?.customer_id],
    enabled: !!profile?.email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_users")
        .select("*")
        .or(`mail.ilike.${profile!.email},user_principal_name.ilike.${profile!.email}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Resolve groups + role mappings for the customer
  const customerId = azureUser?.customer_id ?? profile?.customer_id ?? null;

  const { data: groups = [] } = useQuery({
    queryKey: ["my-azure-groups", customerId, azureUser?.azure_group_ids],
    enabled: !!customerId && !!azureUser?.azure_group_ids?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_groups")
        .select("*")
        .eq("customer_id", customerId!)
        .in("azure_group_id", azureUser!.azure_group_ids as string[]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["my-azure-mappings", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_role_mappings")
        .select("*")
        .eq("customer_id", customerId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const azureGroupIds = (azureUser?.azure_group_ids ?? []) as string[];
  const matchingMappings = mappings.filter((m) => azureGroupIds.includes(m.azure_group_id));
  const azureLastSync = azureUser?.last_synced_at ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Οι ρόλοι μου</h1>
        <p className="text-sm text-muted-foreground">
          Επισκόπηση των δικαιωμάτων του λογαριασμού σου και πώς αποκτήθηκαν.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Ενεργοί ρόλοι στο portal
          </CardTitle>
          <CardDescription>Καταχωρισμένοι ρόλοι και ημερομηνία απόδοσης.</CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <p className="text-sm text-muted-foreground">Φόρτωση...</p>
          ) : roleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν έχουν ανατεθεί ρόλοι.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ρόλος</TableHead>
                  <TableHead>Αποκτήθηκε</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleRows.map((r) => (
                  <TableRow key={r.role}>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel[r.role] ?? r.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(r.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="h-5 w-5 text-accent" />
            Προέλευση από Azure AD
          </CardTitle>
          <CardDescription>
            {azureUser
              ? `Συσχετισμένος Azure χρήστης: ${azureUser.display_name ?? azureUser.user_principal_name}`
              : "Δεν εντοπίστηκε αντίστοιχος χρήστης στο Azure AD."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {azureUser && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">UPN</p>
                <p className="text-sm font-medium">{azureUser.user_principal_name ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Τελευταίος συγχρονισμός
                </p>
                <p className="text-sm font-medium">{formatDate(azureLastSync)}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Ομάδες & ρόλοι που χορηγούν
            </h3>
            {matchingMappings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν αντιστοιχίσεις ομάδας Azure AD που να χορηγούν ρόλους σε εσένα.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ομάδα Azure</TableHead>
                    <TableHead>Ρόλος που χορηγείται</TableHead>
                    <TableHead>Τελευταίος συγχρονισμός ομάδας</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchingMappings.map((m) => {
                    const g = groups.find((gg) => gg.azure_group_id === m.azure_group_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {g?.display_name ?? m.azure_group_name ?? m.azure_group_id}
                        </TableCell>
                        <TableCell>
                          <Badge>{roleLabel[m.role] ?? m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(g?.last_synced_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
