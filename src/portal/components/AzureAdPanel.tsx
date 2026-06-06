import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cloud, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2, Users, Laptop, History, XCircle, KeyRound, Briefcase, Sparkles, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import AzureGroupRoleMappings from "./AzureGroupRoleMappings";

interface Props {
  customerId: string;
}

interface Settings {
  id?: string;
  customer_id: string;
  tenant_id: string;
  client_id: string;
  /** Plain secret only lives in form state; never read back from DB. */
  client_secret: string;
  /** Indicates a secret is already stored encrypted in DB. */
  has_secret?: boolean;
  enabled: boolean;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
}

const empty = (cid: string): Settings => ({
  customer_id: cid,
  tenant_id: "",
  client_id: "",
  client_secret: "",
  enabled: false,
  has_secret: false,
});

export default function AzureAdPanel({ customerId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["azure-ad-settings", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_settings")
        .select("id, customer_id, tenant_id, client_id, enabled, last_sync_at, last_sync_error, client_secret_enc")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (error) throw error;
      const s: Settings = data
        ? {
            id: (data as any).id,
            customer_id: (data as any).customer_id,
            tenant_id: (data as any).tenant_id ?? "",
            client_id: (data as any).client_id ?? "",
            client_secret: "",
            has_secret: !!(data as any).client_secret_enc,
            enabled: !!(data as any).enabled,
            last_sync_at: (data as any).last_sync_at,
            last_sync_error: (data as any).last_sync_error,
          }
        : empty(customerId);
      setForm(s);
      return s;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["azure-ad-users", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_users")
        .select("*")
        .eq("customer_id", customerId)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["azure-ad-devices", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_devices")
        .select("*")
        .eq("customer_id", customerId)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["azure-ad-licenses", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_licenses")
        .select("*")
        .eq("customer_id", customerId)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["azure-ad-sync-logs", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_sync_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: copilot = [] } = useQuery({
    queryKey: ["azure-ad-copilot", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_copilot_usage")
        .select("*")
        .eq("customer_id", customerId)
        .order("user_principal_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const f = form ?? settings ?? empty(customerId);

  // Διαχωρισμός αδειών: Office CALs (Microsoft 365 / Office / Exchange) vs άλλες
  const isOfficeCal = (l: any) => {
    const sku = String(l.sku_part_number ?? "").toUpperCase();
    const name = String(l.display_name ?? "").toUpperCase();
    return /M365|MICROSOFT 365|OFFICE|EXCHANGE|SHAREPOINT|TEAMS|O365|SPE_|SPB|ENTERPRISEPACK|ENTERPRISEPREMIUM|STANDARDPACK|BUSINESS_/.test(sku)
      || /MICROSOFT 365|OFFICE|EXCHANGE|SHAREPOINT|TEAMS/.test(name);
  };
  const officeLicenses = (licenses as any[]).filter(isOfficeCal);
  const otherLicenses = (licenses as any[]).filter((l) => !isOfficeCal(l));

  const validate = (s: Settings): string | null => {
    if (!s.tenant_id.trim()) return "Tenant ID υποχρεωτικό";
    if (!/^[0-9a-f-]{20,}$/i.test(s.tenant_id.trim())) return "Tenant ID μοιάζει μη έγκυρο (αναμένεται GUID)";
    if (!s.client_id.trim()) return "Client ID υποχρεωτικό";
    if (!/^[0-9a-f-]{20,}$/i.test(s.client_id.trim())) return "Client ID μοιάζει μη έγκυρο (αναμένεται GUID)";
    if (!s.client_secret.trim() && !s.has_secret) return "Client Secret υποχρεωτικό";
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validate(f);
      if (err) throw new Error(err);
      // Save via edge function so the secret is encrypted server-side
      // and never written in plaintext to the database.
      const { data, error } = await supabase.functions.invoke("azure-ad-sync", {
        body: {
          customer_id: customerId,
          action: "save_credentials",
          credentials: {
            tenant_id: f.tenant_id.trim(),
            client_id: f.client_id.trim(),
            client_secret: f.client_secret.trim(), // empty string ⇒ keep existing
            enabled: f.enabled,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Οι ρυθμίσεις αποθηκεύτηκαν");
      // Clear secret from memory after save
      if (form) setForm({ ...form, client_secret: "", has_secret: true });
      qc.invalidateQueries({ queryKey: ["azure-ad-settings", customerId] });
    },
    onError: (e: any) => toast.error("Αποτυχία αποθήκευσης", { description: e.message }),
  });

  const callFn = async (action: "test" | "sync") => {
    if (action === "test") {
      const err = validate(f);
      if (err) throw new Error(err);
    }
    const { data, error } = await supabase.functions.invoke("azure-ad-sync", {
      body: {
        customer_id: customerId,
        action,
        override: action === "test"
          ? { tenant_id: f.tenant_id.trim(), client_id: f.client_id.trim(), client_secret: f.client_secret.trim() }
          : undefined,
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const testMutation = useMutation({
    mutationFn: () => callFn("test"),
    onSuccess: (d: any) => toast.success("Σύνδεση επιτυχής", {
      description: d?.organization?.displayName ? `Tenant: ${d.organization.displayName}` : undefined,
    }),
    onError: (e: any) => toast.error("Αποτυχία σύνδεσης", { description: e.message }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["azure-ad-sync-logs", customerId] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => callFn("sync"),
    onSuccess: (d: any) => {
      toast.success("Συγχρονισμός ολοκληρώθηκε", {
        description: `${d?.users ?? 0} χρήστες, ${d?.devices ?? 0} συσκευές, ${d?.licenses ?? 0} άδειες`,
      });
      qc.invalidateQueries({ queryKey: ["azure-ad-settings", customerId] });
      qc.invalidateQueries({ queryKey: ["azure-ad-users", customerId] });
      qc.invalidateQueries({ queryKey: ["azure-ad-devices", customerId] });
      qc.invalidateQueries({ queryKey: ["azure-ad-licenses", customerId] });
    },
    onError: (e: any) => toast.error("Αποτυχία συγχρονισμού", { description: e.message }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["azure-ad-sync-logs", customerId] }),
  });

  const syncCopilotMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("azure-ad-sync", {
        body: { customer_id: customerId, action: "sync_copilot" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success("Copilot data συγχρονίστηκαν", {
        description: `${d?.copilot_users ?? 0} χρήστες (${d?.with_license ?? 0} με assigned license)`,
      });
      qc.invalidateQueries({ queryKey: ["azure-ad-copilot", customerId] });
    },
    onError: (e: any) => toast.error("Αποτυχία Copilot sync", {
      description: e.message?.includes("Reports") ? "Λείπει η Microsoft Graph permission Reports.Read.All" : e.message,
    }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["azure-ad-sync-logs", customerId] }),
  });

  if (isLoading || !form) {
    return <Card className="p-6 text-sm text-muted-foreground">Φόρτωση Azure AD…</Card>;
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm({ ...f, [k]: v });

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0078D4]/10 text-[#0078D4]">
            <Cloud className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Azure AD / Microsoft Entra ID</h2>
            <p className="text-sm text-muted-foreground">
              Συνδέστε το Azure AD του πελάτη για ανάγνωση χρηστών, email και συσκευών (joined/registered).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="azure-enabled" className="text-sm">Ενεργό</Label>
          <Switch id="azure-enabled" checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Tenant ID (Directory ID)</Label>
          <Input
            placeholder="00000000-0000-0000-0000-000000000000"
            value={f.tenant_id}
            onChange={(e) => set("tenant_id", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Client ID (Application ID)</Label>
          <Input
            placeholder="00000000-0000-0000-0000-000000000000"
            value={f.client_id}
            onChange={(e) => set("client_id", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Client Secret</Label>
          <Input
            type="password"
            placeholder={f.has_secret ? "•••••••• (αποθηκευμένο — αφήστε κενό για διατήρηση)" : "Νέο client secret"}
            value={f.client_secret}
            onChange={(e) => set("client_secret", e.target.value)}
          />
          {f.has_secret && (
            <p className="text-[11px] text-muted-foreground">
              Το secret είναι κρυπτογραφημένο (AES-GCM) και δεν εμφανίζεται ποτέ ξανά. Συμπληρώστε νέο μόνο για αλλαγή.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong>Απαιτούμενα Application permissions στο Microsoft Entra app:</strong>{" "}
        <code>User.Read.All</code>, <code>Group.Read.All</code>, <code>Device.Read.All</code>, <code>Directory.Read.All</code> (admin consent).
        Για Copilot usage analytics απαιτείται επιπλέον το <code>Reports.Read.All</code>.
      </div>

      {(f.last_sync_at || f.last_sync_error) && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {f.last_sync_at && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Τελευταίος συγχρ.: {new Date(f.last_sync_at).toLocaleString("el-GR")}
            </Badge>
          )}
          {f.last_sync_error && (
            <Badge variant="outline" className="gap-1 text-brand-red">
              <AlertCircle className="h-3 w-3" />
              {f.last_sync_error}
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Αποθήκευση
        </Button>
        <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
          {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Δοκιμή σύνδεσης
        </Button>
        <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !f.enabled}>
          {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Συγχρονισμός τώρα
        </Button>
      </div>

      <Tabs defaultValue="users" className="pt-2">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-7">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Χρήστες ({users.length})</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><ShieldCheck className="h-4 w-4" />Ρόλοι</TabsTrigger>
          <TabsTrigger value="cals" className="gap-2"><Briefcase className="h-4 w-4" />Office CALs ({officeLicenses.length})</TabsTrigger>
          <TabsTrigger value="devices" className="gap-2"><Laptop className="h-4 w-4" />Συσκευές ({devices.length})</TabsTrigger>
          <TabsTrigger value="licenses" className="gap-2"><KeyRound className="h-4 w-4" />Άδειες ({otherLicenses.length})</TabsTrigger>
          <TabsTrigger value="copilot" className="gap-2"><Sparkles className="h-4 w-4" />Copilot ({copilot.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Ιστορικό ({logs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Όνομα</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">UPN</th>
                  <th className="px-3 py-2 font-semibold">Θέση</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Καμία εγγραφή — πατήστε «Συγχρονισμός».</td></tr>
                )}
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 font-medium">{u.display_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.mail ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.user_principal_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.job_title ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={u.account_enabled ? "default" : "secondary"}>
                        {u.account_enabled ? "Ενεργός" : "Ανενεργός"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="devices" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Όνομα</th>
                  <th className="px-3 py-2 font-semibold">OS</th>
                  <th className="px-3 py-2 font-semibold">Τύπος</th>
                  <th className="px-3 py-2 font-semibold">Εγγραφή</th>
                  <th className="px-3 py-2 font-semibold">Τελευταία σύνδεση</th>
                  <th className="px-3 py-2 font-semibold">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Καμία συσκευή — πατήστε «Συγχρονισμός».</td></tr>
                )}
                {devices.map((d: any) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 font-medium">{d.display_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {d.operating_system ?? "—"} {d.operating_system_version ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={d.join_type === "joined" ? "default" : "outline"}>
                        {d.join_type === "joined" ? "Azure AD Joined" : d.join_type === "registered" ? "Azure AD Registered" : (d.trust_type ?? "—")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {d.registration_datetime ? new Date(d.registration_datetime).toLocaleDateString("el-GR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {d.approximate_last_sign_in ? new Date(d.approximate_last_sign_in).toLocaleDateString("el-GR") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {d.is_compliant === true ? <Badge className="bg-emerald-500/10 text-emerald-700">Compliant</Badge>
                        : d.is_compliant === false ? <Badge variant="destructive">Non-compliant</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="cals" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Office / Microsoft 365 plan</th>
                  <th className="px-3 py-2 font-semibold">SKU</th>
                  <th className="px-3 py-2 font-semibold text-right">CALs σύνολο</th>
                  <th className="px-3 py-2 font-semibold text-right">Σε χρήση</th>
                  <th className="px-3 py-2 font-semibold text-right">Διαθέσιμες</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {officeLicenses.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Δεν βρέθηκαν Office CALs — εκτελέστε «Συγχρονισμός».</td></tr>
                )}
                {officeLicenses.map((l: any) => {
                  const total = l.prepaid_enabled ?? 0;
                  const used = l.consumed_units ?? 0;
                  const free = Math.max(0, total - used);
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-medium">{l.display_name ?? l.sku_part_number ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{l.sku_part_number ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{total}</td>
                      <td className="px-3 py-2 text-right">{used}</td>
                      <td className="px-3 py-2 text-right font-semibold">{free}</td>
                      <td className="px-3 py-2">
                        <Badge variant={l.capability_status === "Enabled" ? "default" : "secondary"}>
                          {l.capability_status ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="licenses" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Άδεια / Προϊόν</th>
                  <th className="px-3 py-2 font-semibold">SKU</th>
                  <th className="px-3 py-2 font-semibold text-right">Σύνολο</th>
                  <th className="px-3 py-2 font-semibold text-right">Σε χρήση</th>
                  <th className="px-3 py-2 font-semibold text-right">Ελεύθερες</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {otherLicenses.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Δεν βρέθηκαν άλλες άδειες (Windows / EMS / Power Platform κ.λπ.).</td></tr>
                )}
                {otherLicenses.map((l: any) => {
                  const total = l.prepaid_enabled ?? 0;
                  const used = l.consumed_units ?? 0;
                  const free = Math.max(0, total - used);
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-medium">{l.display_name ?? l.sku_part_number ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{l.sku_part_number ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{total}</td>
                      <td className="px-3 py-2 text-right">{used}</td>
                      <td className="px-3 py-2 text-right font-semibold">{free}</td>
                      <td className="px-3 py-2">
                        <Badge variant={l.capability_status === "Enabled" ? "default" : "secondary"}>
                          {l.capability_status ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="copilot" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Microsoft 365 Copilot</p>
              <p className="text-xs text-muted-foreground">
                Assigned licenses & 30-ήμερη χρήση ανά χρήστη (απαιτεί <code>Reports.Read.All</code>).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => syncCopilotMutation.mutate()} disabled={syncCopilotMutation.isPending || !f.enabled}>
              {syncCopilotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Συγχρονισμός Copilot
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Σύνολο χρηστών</p>
              <p className="mt-1 font-display text-2xl font-bold">{copilot.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Με assigned license</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {(copilot as any[]).filter((c) => c.has_assigned_license).length}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ενεργοί (30 ημ.)</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {(copilot as any[]).filter((c) => c.last_activity_date).length}
              </p>
            </Card>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Χρήστης</th>
                  <th className="px-3 py-2 font-semibold">License</th>
                  <th className="px-3 py-2 font-semibold">Last activity</th>
                  <th className="px-3 py-2 font-semibold">Chat</th>
                  <th className="px-3 py-2 font-semibold">Teams</th>
                  <th className="px-3 py-2 font-semibold">Word</th>
                  <th className="px-3 py-2 font-semibold">Excel</th>
                  <th className="px-3 py-2 font-semibold">PPT</th>
                  <th className="px-3 py-2 font-semibold">Outlook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {copilot.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Δεν υπάρχουν δεδομένα Copilot — πατήστε «Συγχρονισμός Copilot».</td></tr>
                )}
                {(copilot as any[]).map((c) => {
                  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("el-GR") : "—");
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.display_name ?? c.user_principal_name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.user_principal_name}</div>
                      </td>
                      <td className="px-3 py-2">
                        {c.has_assigned_license ? (
                          <Badge className="bg-[#0078D4]/10 text-[#0078D4]">{c.assigned_sku ?? "Copilot"}</Badge>
                        ) : (
                          <Badge variant="outline">—</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.last_activity_date)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.copilot_chat_last_activity)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.microsoft_teams_copilot_last_activity)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.word_copilot_last_activity)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.excel_copilot_last_activity)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.powerpoint_copilot_last_activity)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(c.outlook_copilot_last_activity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Ημ/νία</th>
                  <th className="px-3 py-2 font-semibold">Ενέργεια</th>
                  <th className="px-3 py-2 font-semibold">Κατάσταση</th>
                  <th className="px-3 py-2 font-semibold">Χρήστες</th>
                  <th className="px-3 py-2 font-semibold">Συσκευές</th>
                  <th className="px-3 py-2 font-semibold">Διάρκεια</th>
                  <th className="px-3 py-2 font-semibold">Σφάλμα</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Δεν υπάρχει ιστορικό συγχρονισμών ακόμη.</td></tr>
                )}
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("el-GR")}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{l.action}</Badge></td>
                    <td className="px-3 py-2">
                      {l.status === "success" ? (
                        <Badge className="gap-1 bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="h-3 w-3" />success</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />error</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.users_synced ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.devices_synced ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{l.duration_ms != null ? `${l.duration_ms} ms` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-brand-red max-w-[320px] truncate" title={l.error_message ?? ""}>{l.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}