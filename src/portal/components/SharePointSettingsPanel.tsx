import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, ExternalLink, Save, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://geniusnet.sharepoint.com";
const SITE_ID =
  "geniusnet.sharepoint.com,ff4640a2-f471-4b81-ba61-a0a62b88f6cb,03dd8b7c-5171-4ed5-a8f8-de0f680af736";
const WORKLOGS_LIST_ID = "10e40751-c27d-4bea-a05e-f96ed8cce2e8";
const CUSTOMERS_LIST_ID = "279a2094-aca7-479a-b6fb-8480ab3d14b4";

export function SharePointSettingsPanel() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { vat_number: string; sharepoint_customer_id: string }>>({});

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["sp-customers-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, vat_number, sharepoint_customer_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (row: { id: string; vat_number: string | null; sharepoint_customer_id: number | null }) => {
      const { error } = await supabase
        .from("customers")
        .update({
          vat_number: row.vat_number,
          sharepoint_customer_id: row.sharepoint_customer_id,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Αποθηκεύτηκε");
      qc.invalidateQueries({ queryKey: ["sp-customers-mapping"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold">Σύνδεση SharePoint Online</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Η σύνδεση γίνεται μέσω του Microsoft SharePoint connector του workspace. Ο πίνακας «Δελτία εργασιών» σε κάθε ticket τραβά αυτόματα δεδομένα από τις λίστες του παρακάτω site.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Site</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs">{SITE_URL}</code>
                  <a href={SITE_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Κατάσταση connector</Label>
                <div className="mt-1"><Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">Ενεργό</Badge></div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Site ID</Label>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[11px]">{SITE_ID}</code>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Λίστα «Καταχώρηση Εργασιών»</Label>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[11px]">{WORKLOGS_LIST_ID}</code>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Λίστα «Πελάτες»</Label>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[11px]">{CUSTOMERS_LIST_ID}</code>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Αντιστοίχιση πελατών</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Το auto-matching γίνεται μέσω <strong>ΑΦΜ</strong> (πεδίο <code>AFM_ATL</code> στη λίστα «Πελάτες» του SharePoint). Εναλλακτικά δώστε χειροκίνητα το SharePoint Customer ID.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Πελάτης</th>
                <th className="px-3 py-2 font-semibold">ΑΦΜ</th>
                <th className="px-3 py-2 font-semibold">SharePoint Customer ID</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Φόρτωση…</td></tr>}
              {!isLoading && customers.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Δεν υπάρχουν πελάτες ακόμη.</td></tr>
              )}
              {customers.map((c: any) => {
                const d = drafts[c.id] ?? {
                  vat_number: c.vat_number ?? "",
                  sharepoint_customer_id: c.sharepoint_customer_id?.toString() ?? "",
                };
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={d.vat_number}
                        onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, vat_number: e.target.value } })}
                        className="h-8"
                        placeholder="π.χ. 123456789"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={d.sharepoint_customer_id}
                        onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, sharepoint_customer_id: e.target.value } })}
                        className="h-8"
                        placeholder="Προαιρετικό"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          save.mutate({
                            id: c.id,
                            vat_number: d.vat_number.trim() || null,
                            sharepoint_customer_id: d.sharepoint_customer_id.trim()
                              ? Number(d.sharepoint_customer_id.trim())
                              : null,
                          })
                        }
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Αποθήκευση
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
