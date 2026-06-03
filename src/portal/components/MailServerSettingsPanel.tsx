import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";

type Provider = "none" | "google" | "microsoft" | "custom";

interface MailSettings {
  id?: string;
  provider: Provider;
  enabled: boolean;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  smtp_password: string | null;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  oauth_refresh_token: string | null;
  oauth_tenant_id: string | null;
}

const empty: MailSettings = {
  provider: "none",
  enabled: false,
  from_email: "",
  from_name: "",
  reply_to: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: "",
  smtp_password: "",
  oauth_client_id: "",
  oauth_client_secret: "",
  oauth_refresh_token: "",
  oauth_tenant_id: "",
};

export function MailServerSettingsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<MailSettings>(empty);

  const { data, isLoading } = useQuery({
    queryKey: ["mail-server-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mail_server_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MailSettings | null;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...empty, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async (f: MailSettings) => {
      const payload = { ...f };
      if (f.id) {
        const { error } = await (supabase as any)
          .from("mail_server_settings")
          .update(payload)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("mail_server_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Οι ρυθμίσεις mail αποθηκεύτηκαν");
      qc.invalidateQueries({ queryKey: ["mail-server-settings"] });
    },
    onError: (e: any) => toast.error("Αποτυχία αποθήκευσης", { description: e.message }),
  });

  const set = <K extends keyof MailSettings>(k: K, v: MailSettings[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const validate = (f: MailSettings): string | null => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!f.from_email || !emailRe.test(f.from_email))
      return "Συμπληρώστε έγκυρο From Email";
    if (f.reply_to && !emailRe.test(f.reply_to))
      return "Μη έγκυρο Reply-To email";

    if (f.provider === "google") {
      if (!f.oauth_client_id?.trim()) return "Google: λείπει OAuth Client ID";
      if (!f.oauth_client_secret?.trim()) return "Google: λείπει OAuth Client Secret";
      if (!f.oauth_refresh_token?.trim()) return "Google: λείπει Refresh Token";
    } else if (f.provider === "microsoft") {
      if (!f.oauth_tenant_id?.trim()) return "Microsoft: λείπει Tenant ID";
      if (!f.oauth_client_id?.trim()) return "Microsoft: λείπει Client ID";
      if (!f.oauth_client_secret?.trim()) return "Microsoft: λείπει Client Secret";
    } else if (f.provider === "custom") {
      if (!f.smtp_host?.trim()) return "SMTP: λείπει Host";
      if (!f.smtp_port || f.smtp_port < 1 || f.smtp_port > 65535)
        return "SMTP: μη έγκυρο Port (1-65535)";
      if (!f.smtp_username?.trim()) return "SMTP: λείπει Username";
      if (!f.smtp_password?.trim()) return "SMTP: λείπει Password";
    } else if (f.provider === "none" && f.enabled) {
      return "Επιλέξτε πάροχο πριν ενεργοποιήσετε την υπηρεσία";
    }
    return null;
  };

  const handleSave = () => {
    const err = validate(form);
    if (err) {
      toast.error("Ελλιπή στοιχεία", { description: err });
      return;
    }
    save.mutate(form);
  };

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Φόρτωση…</Card>;
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold">Mail Server</h3>
            <p className="text-sm text-muted-foreground">
              Ρυθμίστε τον πάροχο email (Google, Microsoft 365 ή custom SMTP) για αποστολή
              ειδοποιήσεων από το portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          <span className="text-sm">{form.enabled ? "Ενεργό" : "Ανενεργό"}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>From Email *</Label>
          <Input
            type="email"
            placeholder="noreply@yourdomain.com"
            value={form.from_email ?? ""}
            onChange={(e) => set("from_email", e.target.value)}
          />
        </div>
        <div>
          <Label>From Name</Label>
          <Input
            placeholder="GeniusNet Support"
            value={form.from_name ?? ""}
            onChange={(e) => set("from_name", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Reply-To</Label>
          <Input
            type="email"
            placeholder="support@yourdomain.com"
            value={form.reply_to ?? ""}
            onChange={(e) => set("reply_to", e.target.value)}
          />
        </div>
      </div>

      <Tabs value={form.provider} onValueChange={(v) => set("provider", v as Provider)}>
        <TabsList>
          <TabsTrigger value="google">Google Workspace</TabsTrigger>
          <TabsTrigger value="microsoft">Microsoft 365</TabsTrigger>
          <TabsTrigger value="custom">Custom SMTP</TabsTrigger>
          <TabsTrigger value="none">Απενεργοποιημένο</TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Συνδέστε λογαριασμό Google Workspace μέσω OAuth 2.0. Δημιουργήστε credentials στο
            Google Cloud Console (Gmail API) και επικολλήστε τα παρακάτω.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>OAuth Client ID</Label>
              <Input
                value={form.oauth_client_id ?? ""}
                onChange={(e) => set("oauth_client_id", e.target.value)}
              />
            </div>
            <div>
              <Label>OAuth Client Secret</Label>
              <Input
                type="password"
                value={form.oauth_client_secret ?? ""}
                onChange={(e) => set("oauth_client_secret", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Refresh Token</Label>
              <Input
                type="password"
                value={form.oauth_refresh_token ?? ""}
                onChange={(e) => set("oauth_refresh_token", e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="microsoft" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Microsoft 365 / Azure AD app registration με Mail.Send permission.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tenant ID</Label>
              <Input
                value={form.oauth_tenant_id ?? ""}
                onChange={(e) => set("oauth_tenant_id", e.target.value)}
              />
            </div>
            <div>
              <Label>Client ID</Label>
              <Input
                value={form.oauth_client_id ?? ""}
                onChange={(e) => set("oauth_client_id", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={form.oauth_client_secret ?? ""}
                onChange={(e) => set("oauth_client_secret", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Refresh Token (αν χρησιμοποιείτε delegated flow)</Label>
              <Input
                type="password"
                value={form.oauth_refresh_token ?? ""}
                onChange={(e) => set("oauth_refresh_token", e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Custom SMTP server (π.χ. on-premise mail server, SendGrid, Mailgun, Postmark κλπ).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>SMTP Host *</Label>
              <Input
                placeholder="smtp.yourdomain.com"
                value={form.smtp_host ?? ""}
                onChange={(e) => set("smtp_host", e.target.value)}
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                placeholder="587"
                value={form.smtp_port ?? ""}
                onChange={(e) => set("smtp_port", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={form.smtp_secure}
                onCheckedChange={(v) => set("smtp_secure", v)}
              />
              <span className="text-sm pb-2">TLS/SSL</span>
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={form.smtp_username ?? ""}
                onChange={(e) => set("smtp_username", e.target.value)}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={form.smtp_password ?? ""}
                onChange={(e) => set("smtp_password", e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="none" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Καμία αποστολή email — οι ειδοποιήσεις παραμένουν μόνο in-app.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? "Αποθήκευση…" : "Αποθήκευση"}
        </Button>
      </div>
    </Card>
  );
}