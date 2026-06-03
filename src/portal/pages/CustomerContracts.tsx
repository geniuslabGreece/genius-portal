import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Building2, FileText, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useContracts, useProducts } from "@/portal/data/hooks";
import { Category, Customer, Contract, contractStatus, daysUntil } from "@/portal/data/types";
import { UserAssignmentTable } from "@/portal/components/UserAssignmentTable";
import AzureAdPanel from "@/portal/components/AzureAdPanel";

// ─────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = ["software", "hardware", "erp", "devices"];

interface ContractForm {
  product_id: string; // "" => create new
  contract_number: string;
  quantity: number;
  unit: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
  renewal_months: number;
  notes: string;
  // new product
  new_product: boolean;
  new_name: string;
  new_category: Category;
  new_vendor: string;
  new_sku: string;
  new_description: string;
}

const emptyForm: ContractForm = {
  product_id: "",
  contract_number: "",
  quantity: 1,
  unit: "units",
  start_date: undefined,
  end_date: undefined,
  renewal_months: 12,
  notes: "",
  new_product: false,
  new_name: "",
  new_category: "software",
  new_vendor: "",
  new_sku: "",
  new_description: "",
};

const statusColor = (s: string) =>
  s === "critical" ? "bg-brand-red/10 text-brand-red"
    : s === "expiring_soon" ? "bg-amber-500/10 text-amber-700"
      : s === "expired" ? "bg-muted text-muted-foreground"
        : "bg-emerald-500/10 text-emerald-700";

const statusLabel = (s: string) =>
  s === "critical" ? "Critical" : s === "expiring_soon" ? "Λήγει σύντομα" : s === "expired" ? "Έληξε" : "Ενεργό";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function CustomerContracts() {
  const { id: customerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Customer
  const { data: customer } = useQuery({
    queryKey: ["customer-admin", customerId],
    queryFn: async (): Promise<Customer | null> => {
      if (!customerId) return null;
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!customerId,
  });

  // Contracts for this customer (admin sees them via RLS)
  const { data: contracts = [], isLoading } = useContracts(customerId);
  const { data: products = [] } = useProducts();

  // UI state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractForm>(emptyForm);

  const filtered = useMemo(() => {
    let list = contracts;
    if (categoryFilter !== "all") list = list.filter((c) => c.product.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.product.name.toLowerCase().includes(q) ||
        (c.product.vendor ?? "").toLowerCase().includes(q) ||
        c.contract_number.toLowerCase().includes(q),
      );
    }
    return list;
  }, [contracts, search, categoryFilter]);

  // Open create dialog
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpenDialog(true);
  };

  // Open edit dialog
  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    setForm({
      product_id: c.product.id,
      contract_number: c.contract_number,
      quantity: c.quantity,
      unit: c.unit,
      start_date: new Date(c.start_date),
      end_date: new Date(c.end_date),
      renewal_months: c.renewal_months,
      notes: c.notes ?? "",
      new_product: false,
      new_name: "",
      new_category: "software",
      new_vendor: "",
      new_sku: "",
      new_description: "",
    });
    setOpenDialog(true);
  };

  // Save mutation (create or update)
  const saveMutation = useMutation({
    mutationFn: async (f: ContractForm) => {
      if (!customerId) throw new Error("Λείπει customer id");
      if (!f.start_date || !f.end_date) throw new Error("Συμπληρώστε ημερομηνίες");
      if (!f.contract_number.trim()) throw new Error("Συμπληρώστε αριθμό συμβολαίου");

      // Resolve product_id (create new product if needed)
      let productId = f.product_id;
      if (f.new_product) {
        if (!f.new_name.trim()) throw new Error("Συμπληρώστε όνομα νέου προϊόντος");
        const { data: newProd, error: prodErr } = await supabase
          .from("products")
          .insert({
            name: f.new_name.trim(),
            category: f.new_category,
            vendor: f.new_vendor.trim() || null,
            sku: f.new_sku.trim() || null,
            description: f.new_description.trim() || null,
          })
          .select()
          .single();
        if (prodErr) throw prodErr;
        productId = newProd.id;
      }
      if (!productId) throw new Error("Επιλέξτε προϊόν ή δημιουργήστε νέο");

      const payload = {
        customer_id: customerId,
        product_id: productId,
        contract_number: f.contract_number.trim(),
        quantity: Math.max(1, f.quantity || 1),
        unit: f.unit.trim() || "units",
        start_date: format(f.start_date, "yyyy-MM-dd"),
        end_date: format(f.end_date, "yyyy-MM-dd"),
        renewal_months: Math.max(1, f.renewal_months || 12),
        notes: f.notes.trim() || null,
        source: "manual" as const,
      };

      if (editingId) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Συμβόλαιο ενημερώθηκε" : "Συμβόλαιο δημιουργήθηκε");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpenDialog(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: any) => toast.error("Αποτυχία αποθήκευσης", { description: e.message }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Συμβόλαιο διαγράφηκε");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: any) => toast.error("Αποτυχία διαγραφής", { description: e.message }),
  });

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { active: 0, expiring_soon: 0, critical: 0, expired: 0 };
    contracts.forEach((c) => { counts[contractStatus(c)] = (counts[contractStatus(c)] ?? 0) + 1; });
    return counts;
  }, [contracts]);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/portal/admin")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Πίσω στο Admin Panel
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Διαχείριση συμβολαίων
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">{customer?.name ?? "…"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer?.vat_number ? `ΑΦΜ ${customer.vat_number} · ` : ""}
              {contracts.length} συμβόλαια συνολικά
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Νέο συμβόλαιο
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ενεργά", value: stats.active ?? 0, color: "text-emerald-700 bg-emerald-500/10" },
          { label: "Λήγουν σύντομα", value: stats.expiring_soon ?? 0, color: "text-amber-700 bg-amber-500/10" },
          { label: "Critical", value: stats.critical ?? 0, color: "text-brand-red bg-brand-red/10" },
          { label: "Ληγμένα", value: stats.expired ?? 0, color: "text-muted-foreground bg-muted" },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-4">
            <span className={cn("grid h-11 w-11 place-items-center rounded-xl", s.color)}>
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση προϊόντος, vendor ή αριθμού συμβολαίου…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι κατηγορίες</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Προϊόν</th>
                <th className="px-4 py-3 font-semibold">Κατηγορία</th>
                <th className="px-4 py-3 font-semibold">Αρ. συμβολαίου</th>
                <th className="px-4 py-3 font-semibold text-right">Ποσότητα</th>
                <th className="px-4 py-3 font-semibold">Λήξη</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Φόρτωση…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Δεν υπάρχουν συμβόλαια. Πατήστε «Νέο συμβόλαιο».
                </td></tr>
              )}
              {filtered.map((c) => {
                const s = contractStatus(c);
                const days = daysUntil(c.end_date);
                return (
                  <tr key={c.id} className="transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.product.name}</div>
                      <div className="text-xs text-muted-foreground">{c.product.vendor ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.product.category.toUpperCase()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.contract_number}</td>
                    <td className="px-4 py-3 text-right">{c.quantity} <span className="text-xs text-muted-foreground">{c.unit}</span></td>
                    <td className="px-4 py-3">
                      <div>{new Date(c.end_date).toLocaleDateString("el-GR")}</div>
                      <div className="text-xs text-muted-foreground">
                        {days < 0 ? `έληξε πριν ${Math.abs(days)}η` : `σε ${days} ημέρες`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", statusColor(s))}>
                        {statusLabel(s)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-brand-red"
                          onClick={() => {
                            if (confirm(`Διαγραφή συμβολαίου "${c.contract_number}";`)) deleteMutation.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assigned users */}
      {customerId && (
        <div className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Χρήστες πελάτη</h2>
            <p className="text-sm text-muted-foreground">
              Όλοι οι λογαριασμοί που είναι ανατεθειμένοι σε αυτή την εταιρεία.
            </p>
          </div>
          <UserAssignmentTable lockedCustomerId={customerId} />
        </div>
      )}

      {/* Azure AD integration */}
      {customerId && (
        <div className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Azure AD σύνδεση</h2>
            <p className="text-sm text-muted-foreground">
              Δέστε το Microsoft Entra (Azure AD) tenant του πελάτη για ανάγνωση χρηστών & συσκευών.
            </p>
          </div>
          <AzureAdPanel customerId={customerId} />
        </div>
      )}

      {/* CRUD Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Επεξεργασία συμβολαίου" : "Νέο συμβόλαιο"}</DialogTitle>
            <DialogDescription>
              Επιλέξτε προϊόν από τον κατάλογο ή δημιουργήστε νέο. Η περίοδος ανανέωσης είναι σε μήνες.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            className="space-y-5"
          >
            {/* Product selection */}
            <Tabs
              value={form.new_product ? "new" : "existing"}
              onValueChange={(v) => setForm({ ...form, new_product: v === "new" })}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Υπάρχον προϊόν</TabsTrigger>
                <TabsTrigger value="new">Δημιουργία νέου</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="mt-4">
                <Label>Προϊόν *</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Επιλέξτε από τον κατάλογο…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {products.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        Δεν υπάρχουν προϊόντα — δημιουργήστε νέο.
                      </div>
                    ) : (
                      products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.vendor ?? "—"} · {p.category}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="new" className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Όνομα προϊόντος *</Label>
                    <Input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Κατηγορία *</Label>
                    <Select
                      value={form.new_category}
                      onValueChange={(v) => setForm({ ...form, new_category: v as Category })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vendor</Label>
                    <Input value={form.new_vendor} onChange={(e) => setForm({ ...form, new_vendor: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>SKU / Model</Label>
                    <Input value={form.new_sku} onChange={(e) => setForm({ ...form, new_sku: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Περιγραφή</Label>
                    <Textarea rows={2} value={form.new_description} onChange={(e) => setForm({ ...form, new_description: e.target.value })} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Contract details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Αριθμός συμβολαίου *</Label>
                <Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} required />
              </div>
              <div>
                <Label>Ποσότητα *</Label>
                <Input
                  type="number" min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div>
                <Label>Μονάδα μέτρησης</Label>
                <Input
                  placeholder="π.χ. licenses, devices, units"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div>
                <Label>Ημ/νία έναρξης *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button" variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}
                    >
                      <CalIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, "dd/MM/yyyy") : "Επιλέξτε ημερομηνία"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.start_date}
                      onSelect={(d) => setForm({ ...form, start_date: d })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Ημ/νία λήξης *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button" variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}
                    >
                      <CalIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, "dd/MM/yyyy") : "Επιλέξτε ημερομηνία"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.end_date}
                      onSelect={(d) => setForm({ ...form, end_date: d })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-2">
                <Label>Περίοδος ανανέωσης (μήνες)</Label>
                <Input
                  type="number" min={1}
                  value={form.renewal_months}
                  onChange={(e) => setForm({ ...form, renewal_months: parseInt(e.target.value) || 12 })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Σημειώσεις</Label>
                <Textarea
                  rows={3}
                  placeholder="Πληροφορίες για το συμβόλαιο, ειδικοί όροι, contact persons…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenDialog(false)}>Άκυρο</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Αποθήκευση…" : editingId ? "Ενημέρωση" : "Δημιουργία"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
