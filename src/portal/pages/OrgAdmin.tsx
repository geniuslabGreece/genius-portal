import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/portal/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AzureAdPanel from "@/portal/components/AzureAdPanel";

/**
 * OrgAdmin: Διαχείριση οργανισμού για customer_admin.
 * Υποστηρίζει χρήστες που ανήκουν σε πολλές εταιρείες (μέσω user_customer_admins
 * ή legacy profile.customer_id). Επιλογή τρέχουσας εταιρείας από dropdown.
 */
export default function OrgAdmin() {
  const { profile, adminCustomerIds, isAdmin } = useAuth();

  // Συγκεντρώνουμε όλες τις εταιρείες στις οποίες έχει πρόσβαση ο χρήστης.
  const accessibleIds = useMemo(() => {
    const ids = new Set<string>(adminCustomerIds);
    if (profile?.customer_id) ids.add(profile.customer_id);
    return Array.from(ids);
  }, [adminCustomerIds, profile?.customer_id]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["org-admin-customers", accessibleIds.sort().join(",")],
    queryFn: async () => {
      if (accessibleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", accessibleIds)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: accessibleIds.length > 0,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && customers.length) setSelectedId(customers[0].id);
  }, [customers, selectedId]);

  if (accessibleIds.length === 0 && !isAdmin) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Δεν έχετε ανατεθεί σε εταιρεία. Επικοινωνήστε με τον διαχειριστή.
      </Card>
    );
  }

  const current = customers.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Διαχείριση οργανισμού
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {current?.name ?? "Ο οργανισμός μου"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Σύνδεση με Microsoft Entra ID, συγχρονισμός χρηστών, Office CALs, συσκευών και αδειών.
            </p>
          </div>
        </div>

        {customers.length > 1 && (
          <div className="min-w-[260px]">
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" /> Εταιρεία
            </Label>
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε εταιρεία" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Φόρτωση…</Card>
      ) : selectedId ? (
        <AzureAdPanel customerId={selectedId} />
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Επιλέξτε εταιρεία για να συνεχίσετε.
        </Card>
      )}
    </div>
  );
}
