import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Building2, Users, FileText, Activity, Trash2, X, Settings, Plug, LifeBuoy, Mail, Cloud, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAllCustomers } from "@/portal/data/hooks";
import { UserAssignmentTable } from "@/portal/components/UserAssignmentTable";
import { CustomerAdminAssignments } from "@/portal/components/CustomerAdminAssignments";
import { SoftOneSettingsPanel } from "@/portal/components/SoftOneSettingsPanel";
import { ProductsPanel } from "@/portal/components/ProductsPanel";
import { AdminTicketsPanel } from "@/portal/components/AdminTicketsPanel";
import { MailServerSettingsPanel } from "@/portal/components/MailServerSettingsPanel";
import { AdminAzureAdPanel } from "@/portal/components/AdminAzureAdPanel";
import { UserRolesPanel } from "@/portal/components/UserRolesPanel";

interface CustomerForm {
  name: string;
  vat_number: string;
  email: string;
  phone: string;
  address: string;
  account_manager_name: string;
  account_manager_email: string;
  account_manager_phone: string;
  notes: string;
  email_domains: string;
}

const emptyForm: CustomerForm = {
  name: "", vat_number: "", email: "", phone: "", address: "",
  account_manager_name: "", account_manager_email: "", account_manager_phone: "",
  notes: "", email_domains: "",
};

export default function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const { data: customers = [], isLoading } = useAllCustomers();

  // Email domains for each customer
  const { data: domainsByCustomer = {} } = useQuery({
    queryKey: ["customer-domains-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_email_domains").select("*");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((d: any) => {
        map[d.customer_id] = [...(map[d.customer_id] ?? []), d.domain];
      });
      return map;
    },
  });

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.vat_number ?? "").includes(search) ||
      (domainsByCustomer[c.id] ?? []).some((d) => d.toLowerCase().includes(q))
    );
  });

  const createCustomer = useMutation({
    mutationFn: async (f: CustomerForm) => {
      // Insert customer
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          name: f.name,
          vat_number: f.vat_number || null,
          email: f.email || null,
          phone: f.phone || null,
          address: f.address || null,
          account_manager_name: f.account_manager_name || null,
          account_manager_email: f.account_manager_email || null,
          account_manager_phone: f.account_manager_phone || null,
          notes: f.notes || null,
        })
        .select()
        .single();
      if (custErr) throw custErr;

      // Insert domains
      const domains = f.email_domains
        .split(/[,\s]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
      if (domains.length > 0 && newCust) {
        const { error: domErr } = await supabase
          .from("customer_email_domains")
          .insert(domains.map((d) => ({ customer_id: newCust.id, domain: d })));
        if (domErr) throw domErr;
      }
      return newCust;
    },
    onSuccess: () => {
      toast.success("Πελάτης δημιουργήθηκε");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-domains-all"] });
      setOpenCreate(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Πελάτης διαγράφηκε");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-domains-all"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const totalContracts = customers.reduce((s, c) => s + (c.contract_count ?? 0), 0);

  const stats = [
    { label: "Πελάτες", value: customers.length, icon: Building2, color: "text-primary bg-primary/10" },
    { label: "Συμβόλαια", value: totalContracts, icon: FileText, color: "text-accent bg-accent/10" },
    { label: "Email Domains", value: Object.values(domainsByCustomer).reduce((s, arr) => s + arr.length, 0), icon: Users, color: "text-brand-red bg-brand-red/10" },
    { label: "Πηγή: Manual", value: "Active", icon: Activity, color: "text-emerald-600 bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Διαχείριση</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Διαχείριση πελατών, email domains και συμβολαίων.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Νέος πελάτης</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Δημιουργία νέου πελάτη</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createCustomer.mutate(form); }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Επωνυμία *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>ΑΦΜ</Label>
                  <Input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
                </div>
                <div>
                  <Label>Τηλέφωνο</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Email επιχείρησης</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Διεύθυνση</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Email Domains (για auto-mapping χρηστών)</Label>
                  <Input
                    placeholder="π.χ. stergiou.gr, stergiou-group.com"
                    value={form.email_domains}
                    onChange={(e) => setForm({ ...form, email_domains: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Διαχωρίστε με κόμμα. Όποιος συνδεθεί με email αυτού του domain ανατίθεται αυτόματα στον πελάτη.
                  </p>
                </div>
                <div>
                  <Label>Account Manager — Όνομα</Label>
                  <Input value={form.account_manager_name} onChange={(e) => setForm({ ...form, account_manager_name: e.target.value })} />
                </div>
                <div>
                  <Label>Account Manager — Τηλέφωνο</Label>
                  <Input value={form.account_manager_phone} onChange={(e) => setForm({ ...form, account_manager_phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Account Manager — Email</Label>
                  <Input type="email" value={form.account_manager_email} onChange={(e) => setForm({ ...form, account_manager_email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Σημειώσεις</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>Άκυρο</Button>
                <Button type="submit" disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? "Αποθήκευση…" : "Δημιουργία"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-4">
            <span className={cn("grid h-11 w-11 place-items-center rounded-xl", s.color)}>
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Πελάτες</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-1.5 h-3.5 w-3.5" />Χρήστες</TabsTrigger>
          <TabsTrigger value="customer-admins"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Customer Admins</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Ρόλοι</TabsTrigger>
          <TabsTrigger value="products"><FileText className="mr-1.5 h-3.5 w-3.5" />Προϊόντα</TabsTrigger>
          <TabsTrigger value="tickets"><LifeBuoy className="mr-1.5 h-3.5 w-3.5" />Tickets</TabsTrigger>
          <TabsTrigger value="softone"><Plug className="mr-1.5 h-3.5 w-3.5" />SoftOne ERP</TabsTrigger>
          <TabsTrigger value="mail"><Mail className="mr-1.5 h-3.5 w-3.5" />Mail Server</TabsTrigger>
          <TabsTrigger value="azure"><Cloud className="mr-1.5 h-3.5 w-3.5" />Azure AD</TabsTrigger>
          <TabsTrigger value="howto">Οδηγός</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Αναζήτηση επωνυμίας, ΑΦΜ ή domain…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length} αποτελέσματα</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Επωνυμία</th>
                    <th className="px-4 py-3 font-semibold">ΑΦΜ</th>
                    <th className="px-4 py-3 font-semibold">Email Domains</th>
                    <th className="px-4 py-3 font-semibold text-right">Συμβόλαια</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Φόρτωση…</td></tr>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Δεν υπάρχουν πελάτες. Πατήστε «Νέος πελάτης» για να δημιουργήσετε.
                    </td></tr>
                  )}
                  {filtered.map((c) => (
                    <tr key={c.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.vat_number ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(domainsByCustomer[c.id] ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            (domainsByCustomer[c.id] ?? []).map((d) => (
                              <span key={d} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                                @{d}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{c.contract_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          c.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700",
                        )}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => navigate(`/portal/admin/customers/${c.id}`)}
                          >
                            <Settings className="mr-1.5 h-3.5 w-3.5" />
                            Συμβόλαια
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-brand-red"
                            onClick={() => {
                              if (confirm(`Διαγραφή του πελάτη "${c.name}";`)) deleteCustomer.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserAssignmentTable />
        </TabsContent>

        <TabsContent value="customer-admins" className="mt-4">
          <CustomerAdminAssignments />
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <ProductsPanel />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <AdminTicketsPanel />
        </TabsContent>

        <TabsContent value="softone" className="mt-4">
          <SoftOneSettingsPanel />
        </TabsContent>

        <TabsContent value="mail" className="mt-4">
          <MailServerSettingsPanel />
        </TabsContent>

        <TabsContent value="azure" className="mt-4">
          <AdminAzureAdPanel />
        </TabsContent>

        <TabsContent value="howto" className="mt-4">
          <Card className="p-6 text-sm leading-relaxed text-foreground space-y-4">
            <div>
              <h3 className="font-display text-base font-semibold">1. Δημιουργία πελάτη</h3>
              <p className="mt-1 text-muted-foreground">
                Πατήστε «Νέος πελάτης», συμπληρώστε τα στοιχεία και προσθέστε ένα ή περισσότερα email domains
                (π.χ. <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">stergiou.gr</code>). Όποιος συνδεθεί
                με email αυτού του domain ανατίθεται αυτόματα στον πελάτη.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">2. Καταχώρηση συμβολαίων</h3>
              <p className="mt-1 text-muted-foreground">
                Η σελίδα διαχείρισης συμβολαίων προστίθεται στην επόμενη φάση. Στο μεταξύ τα συμβόλαια
                εισάγονται μέσω της βάσης ή του Lovable Cloud dashboard.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">3. Ανάθεση admin role</h3>
              <p className="mt-1 text-muted-foreground">
                Όλοι οι νέοι χρήστες έχουν αυτόματα ρόλο <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">customer_user</code>.
                Για να γίνει κάποιος admin, προσθέστε εγγραφή στον πίνακα <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">user_roles</code>
                με τιμή <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">admin</code> από το Cloud dashboard.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">4. Αυτοματοποιημένες ειδοποιήσεις λήξης</h3>
              <p className="mt-1 text-muted-foreground">
                Στη Φάση 4 θα προστεθεί scheduled Edge Function που στέλνει email + in-app ειδοποιήσεις
                στα T-60 / T-30 / T-7 / T-0 για κάθε συμβόλαιο.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
