import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Plug,
  Server,
  Cloud,
  Database,
  History,
  Users as UsersIcon,
  Package,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DeploymentType = "on_premise" | "azure";

interface SoftOneSettings {
  id: string;
  enabled: boolean;
  deployment_type: DeploymentType;
  service_url: string | null;
  username: string | null;
  password: string | null;
  app_id: string | null;
  company: string | null;
  branch: string | null;
  module: string | null;
  refid: string | null;
  customers_sql: string | null;
  products_sql: string | null;
  contracts_sql: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
}

export function SoftOneSettingsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SoftOneSettings | null>(null);

  const {
    data: settings,
    isLoading,
    isError: settingsFailed,
    error: settingsError,
    refetch: refetchSettings,
    isFetching: settingsFetching,
  } = useQuery({
    queryKey: ["softone-settings"],
    queryFn: async (): Promise<SoftOneSettings | null> => {
      const { data, error } = await supabase
        .from("softone_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as SoftOneSettings;
      // No settings row yet — create an empty, disabled one so the form renders.
      const { data: created, error: insErr } = await supabase
        .from("softone_settings")
        .insert({ enabled: false, deployment_type: "on_premise" } as never)
        .select("*")
        .single();
      if (insErr) throw insErr;
      return created as unknown as SoftOneSettings;
    },
    retry: 1,
  });


  const { data: logs = [] } = useQuery({
    queryKey: ["softone-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("softone_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase
        .from("softone_settings")
        .update({
          enabled: form.enabled,
          deployment_type: form.deployment_type,
          service_url: form.service_url,
          username: form.username,
          password: form.password,
          app_id: form.app_id,
          company: form.company,
          branch: form.branch,
          module: form.module,
          refid: form.refid,
          customers_sql: form.customers_sql,
          products_sql: form.products_sql,
          contracts_sql: form.contracts_sql,
        } as never)
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ρυθμίσεις αποθηκεύτηκαν");
      qc.invalidateQueries({ queryKey: ["softone-settings"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("softone-sync", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Sync failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success("Sync ολοκληρώθηκε", {
        description: `${data.customersSynced ?? 0} πελάτες · ${data.productsSynced ?? 0} προϊόντα · ${data.contractsSynced ?? 0} συμβόλαια`,
      });
      qc.invalidateQueries({ queryKey: ["softone-settings"] });
      qc.invalidateQueries({ queryKey: ["softone-logs"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: any) => toast.error("Αποτυχία sync", { description: e.message }),
  });

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Φόρτωση…</Card>;
  }

  if (settingsFailed) {
    const message = settingsError instanceof Error
      ? settingsError.message
      : "Δεν ήταν δυνατή η ανάκτηση των ρυθμίσεων SoftOne.";

    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold">Αποτυχία φόρτωσης ρυθμίσεων SoftOne</p>
              <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetchSettings()}
            disabled={settingsFetching}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", settingsFetching && "animate-spin")} />
            {settingsFetching ? "Επανάληψη…" : "Δοκιμή ξανά"}
          </Button>
        </div>
      </Card>
    );
  }

  if (!form) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Οι ρυθμίσεις SoftOne δεν είναι διαθέσιμες. Πατήστε «Δοκιμή ξανά» για επαναφόρτωση.
        <Button variant="outline" className="mt-4 flex" onClick={() => refetchSettings()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Δοκιμή ξανά
        </Button>
      </Card>
    );
  }

  const upd = <K extends keyof SoftOneSettings>(k: K, v: SoftOneSettings[K]) =>
    setForm({ ...form, [k]: v });

  const credentialsReady =
    !!form.service_url && !!form.username && !!form.password;

  return (
    <div className="space-y-4">
      {/* HEADER + STATUS + SYNC BUTTON */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-gradient-to-br from-primary/5 via-background to-background p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Plug className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold">SoftOne ERP Integration</h3>
                <Badge variant="secondary" className={cn(form.enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted")}>
                  {form.enabled ? "Ενεργό" : "Ανενεργό"}
                </Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Read-only σύνδεση με το SoftOne ERP — υποστηρίζει on-premise SQL Server αλλά και Azure deployment.
                Κάνει import πελάτες, προϊόντα και συμβόλαια.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              size="lg"
              onClick={() => sync.mutate()}
              disabled={sync.isPending || !form.enabled || !credentialsReady}
              className="min-w-[220px]"
            >
              <RefreshCw className={cn("mr-2 h-5 w-5", sync.isPending && "animate-spin")} />
              {sync.isPending ? "Συγχρονισμός…" : "Συγχρονισμός τώρα"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Εισάγει πελάτες · προϊόντα · συμβόλαια
            </p>
          </div>
        </div>

        {form.last_sync_at && (
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3 text-sm">
            {form.last_sync_status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                Τελευταίο sync: {new Date(form.last_sync_at).toLocaleString("el-GR")}
                {form.last_sync_status && (
                  <span className="ml-2 text-xs text-muted-foreground">({form.last_sync_status})</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{form.last_sync_message}</p>
            </div>
          </div>
        )}

        {/* ACTIVATION + DEPLOYMENT TYPE */}
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <Label className="text-sm font-semibold">Ενεργοποίηση integration</Label>
              <p className="text-xs text-muted-foreground">
                Όταν είναι ενεργό, το κουμπί συγχρονισμού καλεί το SoftOne Web Services.
              </p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => upd("enabled", v)} />
          </div>

          <div>
            <Label className="text-sm font-semibold">Τύπος εγκατάστασης SoftOne</Label>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => upd("deployment_type", "on_premise")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition",
                  form.deployment_type === "on_premise"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Server className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">On-Premise SQL</p>
                  <p className="text-xs text-muted-foreground">
                    SoftOne σε τοπικό server με MS SQL Server. Ο S1 Web Services εκτίθεται μέσα από το LAN ή με port forwarding.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => upd("deployment_type", "azure")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition",
                  form.deployment_type === "azure"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Cloud className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Azure / Cloud</p>
                  <p className="text-xs text-muted-foreground">
                    SoftOne hosted στο Azure (IaaS ή SaaS). Συνήθως public HTTPS endpoint του S1 Web Services.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* CONNECTION SECTION */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h4 className="font-display text-base font-semibold">Στοιχεία σύνδεσης</h4>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Service URL *</Label>
            <Input
              placeholder={
                form.deployment_type === "azure"
                  ? "https://your-tenant.azurewebsites.net/s1services"
                  : "https://your-server.com/s1services"
              }
              value={form.service_url ?? ""}
              onChange={(e) => upd("service_url", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Το endpoint του SoftOne Web Services. {form.deployment_type === "azure"
                ? "Για Azure, χρησιμοποιήστε το public HTTPS URL."
                : "Για on-premise, βεβαιωθείτε ότι ο server είναι προσβάσιμος από το internet."}
            </p>
          </div>
          <div>
            <Label>Username *</Label>
            <Input value={form.username ?? ""} onChange={(e) => upd("username", e.target.value)} />
          </div>
          <div>
            <Label>Password *</Label>
            <Input
              type="password"
              value={form.password ?? ""}
              onChange={(e) => upd("password", e.target.value)}
            />
          </div>
          <div>
            <Label>App ID</Label>
            <Input value={form.app_id ?? ""} onChange={(e) => upd("app_id", e.target.value)} />
          </div>
          <div>
            <Label>Company</Label>
            <Input value={form.company ?? ""} onChange={(e) => upd("company", e.target.value)} />
          </div>
          <div>
            <Label>Branch</Label>
            <Input value={form.branch ?? ""} onChange={(e) => upd("branch", e.target.value)} />
          </div>
          <div>
            <Label>Module</Label>
            <Input value={form.module ?? ""} onChange={(e) => upd("module", e.target.value)} />
          </div>
          <div>
            <Label>Ref ID</Label>
            <Input value={form.refid ?? ""} onChange={(e) => upd("refid", e.target.value)} />
          </div>
        </div>
      </Card>

      {/* SQL QUERIES SECTION */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h4 className="font-display text-base font-semibold">SQL Queries — τι θα εισάγεται</h4>
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-semibold">Πελάτες (customers)</Label>
            </div>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={form.customers_sql ?? ""}
              onChange={(e) => upd("customers_sql", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Στήλες: <code>id</code>, <code>name</code>, <code>vat</code>, <code>email</code>, <code>phone</code>, <code>address</code>.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-semibold">Προϊόντα (products)</Label>
            </div>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={form.products_sql ?? ""}
              onChange={(e) => upd("products_sql", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Στήλες: <code>code</code> (μοναδικός κωδικός), <code>name</code>, <code>vendor</code>, προαιρετικά <code>sku</code>, <code>description</code>.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-semibold">Συμβόλαια (contracts)</Label>
            </div>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={form.contracts_sql ?? ""}
              onChange={(e) => upd("contracts_sql", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Στήλες: <code>customer_id</code> (SoftOne TRDR), <code>product_code</code>, <code>product_name</code>, <code>contract_number</code>, <code>quantity</code>, <code>start_date</code>, <code>end_date</code>, <code>notes</code>.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {save.isPending ? "Αποθήκευση…" : "Αποθήκευση ρυθμίσεων"}
          </Button>
          {!credentialsReady && (
            <span className="text-xs text-amber-700">
              Συμπληρώστε URL, username και password για να ενεργοποιηθεί το sync.
            </span>
          )}
        </div>
      </Card>

      {/* HISTORY */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h4 className="font-display text-base font-semibold">Ιστορικό συγχρονισμών</h4>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν εγγραφές ακόμα.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <Badge
                  variant="secondary"
                  className={cn(
                    l.status === "success"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : l.status === "partial"
                        ? "bg-amber-500/10 text-amber-700"
                        : "bg-brand-red/10 text-brand-red",
                  )}
                >
                  {l.status}
                </Badge>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("el-GR")} · {l.duration_ms}ms
                  </p>
                  <p className="text-xs">
                    {l.customers_synced ?? 0} customers · {l.products_synced ?? 0} products · {l.contracts_synced ?? 0} contracts · {l.errors_count ?? 0} errors
                  </p>
                  {l.message && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{l.message}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}