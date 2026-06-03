import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Building2, ShieldCheck, LogOut, Users, Laptop, Cloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/portal/auth/AuthContext";
import { useCurrentCustomer } from "@/portal/data/hooks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Account() {
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();
  const { data: customer } = useCurrentCustomer();

  const { data: azureUsers = [] } = useQuery({
    queryKey: ["my-azure-users", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_users")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: azureDevices = [] } = useQuery({
    queryKey: ["my-azure-devices", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_devices")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const primaryRole = roles[0] ?? "customer_user";
  const hasAzure = azureUsers.length > 0 || azureDevices.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Λογαριασμός
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Στοιχεία λογαριασμού</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Συνδεδεμένος ως</p>
              <p className="font-semibold">{profile?.full_name ?? profile?.email ?? "—"}</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{profile?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Ρόλος</dt>
              <dd className="font-medium">{primaryRole}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Πάροχος</dt>
              <dd className="font-medium capitalize">{profile?.provider ?? "email"}</dd>
            </div>
          </dl>
          <Button variant="outline" className="mt-6 w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Αποσύνδεση
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10 text-accent">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Εταιρεία</p>
              <p className="font-semibold">{customer?.name ?? "Δεν έχει ανατεθεί"}</p>
            </div>
          </div>
          {customer ? (
            <dl className="mt-5 space-y-3 text-sm">
              {customer.vat_number && (
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">ΑΦΜ</dt>
                  <dd className="font-medium">{customer.vat_number}</dd>
                </div>
              )}
              {customer.email && (
                <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Email</dt>
                  <dd className="font-medium">{customer.email}</dd>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Τηλέφωνο</dt>
                  <dd className="font-medium">{customer.phone}</dd>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Διεύθυνση</dt>
                  <dd className="text-right font-medium">{customer.address}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Επικοινωνήστε με τον διαχειριστή για να συνδεθείτε με την εταιρεία σας.
            </p>
          )}
        </Card>
      </div>

      {customer?.account_manager_name && (
        <Card className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account Manager</p>
          <p className="mt-2 font-display text-xl font-semibold">{customer.account_manager_name}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {customer.account_manager_email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${customer.account_manager_email}`}>
                  <Mail className="mr-2 h-4 w-4" /> {customer.account_manager_email}
                </a>
              </Button>
            )}
            {customer.account_manager_phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${customer.account_manager_phone}`}>
                  <Phone className="mr-2 h-4 w-4" /> {customer.account_manager_phone}
                </a>
              </Button>
            )}
          </div>
        </Card>
      )}

      {customer && hasAzure && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0078D4]/10 text-[#0078D4]">
              <Cloud className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Microsoft Entra ID</p>
              <h2 className="font-display text-xl font-bold">Χρήστες & Συσκευές οργανισμού</h2>
              <p className="text-sm text-muted-foreground">
                Δεδομένα από τον τελευταίο συγχρονισμό με το Azure AD του οργανισμού σας.
              </p>
            </div>
          </div>

          <Tabs defaultValue="users" className="mt-5">
            <TabsList>
              <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Χρήστες ({azureUsers.length})</TabsTrigger>
              <TabsTrigger value="devices" className="gap-2"><Laptop className="h-4 w-4" />Συσκευές ({azureDevices.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="mt-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Όνομα</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Θέση</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {azureUsers.map((u: any) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2 font-medium">{u.display_name ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.mail ?? u.user_principal_name ?? "—"}</td>
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
                      <th className="px-3 py-2 font-semibold">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {azureDevices.map((d: any) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium">{d.display_name ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.operating_system ?? "—"} {d.operating_system_version ?? ""}</td>
                        <td className="px-3 py-2">
                          <Badge variant={d.join_type === "joined" ? "default" : "outline"}>
                            {d.join_type === "joined" ? "Azure AD Joined" : d.join_type === "registered" ? "Azure AD Registered" : (d.trust_type ?? "—")}
                          </Badge>
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
          </Tabs>
        </Card>
      )}
    </div>
  );
}
