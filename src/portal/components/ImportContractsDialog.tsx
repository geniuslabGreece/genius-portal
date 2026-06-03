import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Upload, Plus, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, useAllCustomers } from "@/portal/data/hooks";
import { useAuth } from "@/portal/auth/AuthContext";
import { Category, categoryMeta } from "@/portal/data/types";

const CATEGORIES: Category[] = ["software", "hardware", "erp", "devices"];

interface QuickForm {
  customer_id: string;
  product_id: string;
  contract_number: string;
  quantity: number;
  unit: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
  renewal_months: number;
  notes: string;
  new_product: boolean;
  new_name: string;
  new_vendor: string;
  new_sku: string;
  new_description: string;
}

const makeEmpty = (defaultCustomer: string, _defaultCategory: Category): QuickForm => ({
  customer_id: defaultCustomer,
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
  new_vendor: "",
  new_sku: "",
  new_description: "",
});

interface CsvRow {
  contract_number: string;
  product_name: string;
  vendor: string;
  sku: string;
  quantity: number;
  unit: string;
  start_date: string;
  end_date: string;
  renewal_months: number;
  notes: string;
  // validation
  errors: string[];
}

const REQUIRED_HEADERS = [
  "contract_number", "product_name", "start_date", "end_date",
];
const ALL_HEADERS = [
  "contract_number", "product_name", "vendor", "sku",
  "quantity", "unit", "start_date", "end_date", "renewal_months", "notes",
];

const SAMPLE_CSV = `contract_number,product_name,vendor,sku,quantity,unit,start_date,end_date,renewal_months,notes
CN-2026-001,Microsoft 365 Business,Microsoft,M365-BUS,25,licenses,2026-01-01,2027-01-01,12,Annual subscription
CN-2026-002,WatchGuard Firebox T45,WatchGuard,WGT45,1,units,2026-02-15,2027-02-15,12,`;

const parseCsv = (text: string): { headers: string[]; rows: string[][]; error?: string } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) return { headers: [], rows: [], error: "Άδειο αρχείο" };
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
};

const validateRow = (
  raw: Record<string, string>,
): CsvRow => {
  const errors: string[] = [];
  const contract_number = (raw.contract_number ?? "").trim();
  const product_name = (raw.product_name ?? "").trim();
  const start_date = (raw.start_date ?? "").trim();
  const end_date = (raw.end_date ?? "").trim();
  if (!contract_number) errors.push("contract_number κενό");
  if (!product_name) errors.push("product_name κενό");
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  if (!isDate(start_date)) errors.push("start_date μη έγκυρη (YYYY-MM-DD)");
  if (!isDate(end_date)) errors.push("end_date μη έγκυρη (YYYY-MM-DD)");
  if (isDate(start_date) && isDate(end_date) && new Date(end_date) <= new Date(start_date)) {
    errors.push("end_date <= start_date");
  }
  const qty = Number(raw.quantity ?? "1") || 1;
  const months = Number(raw.renewal_months ?? "12") || 12;
  return {
    contract_number,
    product_name,
    vendor: (raw.vendor ?? "").trim(),
    sku: (raw.sku ?? "").trim(),
    quantity: Math.max(1, qty),
    unit: (raw.unit ?? "units").trim() || "units",
    start_date,
    end_date,
    renewal_months: Math.max(1, months),
    notes: (raw.notes ?? "").trim(),
    errors,
  };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category;
  /** Όταν είναι defined, χρησιμοποιείται και κρύβεται το customer picker */
  customerId?: string;
}

export function ImportContractsDialog({ open, onOpenChange, category, customerId }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useAllCustomers();

  const [tab, setTab] = useState<"single" | "csv">("single");
  const [form, setForm] = useState<QuickForm>(makeEmpty(customerId ?? "", category));

  // CSV state
  const [csvText, setCsvText] = useState("");
  const [csvCustomerId, setCsvCustomerId] = useState(customerId ?? "");
  const [csvCategory, setCsvCategory] = useState<Category>(category);

  // Reset όταν αλλάζει το context ή ανοίγει
  useEffect(() => {
    if (open) {
      setForm(makeEmpty(customerId ?? "", category));
      setCsvCustomerId(customerId ?? "");
      setCsvCategory(category);
      setCsvText("");
      setTab("single");
    }
  }, [open, customerId, category]);

  // Auto-prefill quick form to "create new product" by default όταν δεν υπάρχουν προϊόντα στην κατηγορία
  const productsInCategory = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category],
  );

  // ─────────── Single (quick add) ───────────
  const singleMutation = useMutation({
    mutationFn: async (f: QuickForm) => {
      if (!f.customer_id) throw new Error("Επιλέξτε πελάτη");
      if (!f.start_date || !f.end_date) throw new Error("Συμπληρώστε ημερομηνίες");
      if (!f.contract_number.trim()) throw new Error("Συμπληρώστε αριθμό συμβολαίου");

      let productId = f.product_id;
      if (f.new_product) {
        if (!f.new_name.trim()) throw new Error("Συμπληρώστε όνομα νέου προϊόντος");
        const { data: newProd, error: prodErr } = await supabase
          .from("products")
          .insert({
            name: f.new_name.trim(),
            category, // πάντα η τρέχουσα κατηγορία του tab
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

      const { error } = await supabase.from("contracts").insert({
        customer_id: f.customer_id,
        product_id: productId,
        contract_number: f.contract_number.trim(),
        quantity: Math.max(1, f.quantity || 1),
        unit: f.unit.trim() || "units",
        start_date: format(f.start_date, "yyyy-MM-dd"),
        end_date: format(f.end_date, "yyyy-MM-dd"),
        renewal_months: Math.max(1, f.renewal_months || 12),
        notes: f.notes.trim() || null,
        source: "manual" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Συμβόλαιο δημιουργήθηκε");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  // ─────────── CSV bulk ───────────
  const parsed = useMemo(() => {
    if (!csvText.trim()) return null;
    const { headers, rows, error } = parseCsv(csvText);
    if (error) return { error, headers: [], parsedRows: [] as CsvRow[] };
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      return { error: `Λείπουν στήλες: ${missing.join(", ")}`, headers, parsedRows: [] };
    }
    const parsedRows: CsvRow[] = rows.map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
      return validateRow(obj);
    });
    return { headers, parsedRows, error: undefined as string | undefined };
  }, [csvText]);

  const validRows = parsed?.parsedRows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.parsedRows.filter((r) => r.errors.length > 0) ?? [];

  const csvMutation = useMutation({
    mutationFn: async () => {
      if (!csvCustomerId) throw new Error("Επιλέξτε πελάτη");
      if (validRows.length === 0) throw new Error("Δεν υπάρχουν έγκυρες γραμμές");

      // 1) Συγκέντρωσε μοναδικά product names + δες ποια ήδη υπάρχουν
      const wantedNames = Array.from(new Set(validRows.map((r) => r.product_name)));
      const { data: existing, error: exErr } = await supabase
        .from("products")
        .select("id, name, category")
        .in("name", wantedNames);
      if (exErr) throw exErr;

      const nameToId = new Map<string, string>();
      (existing ?? []).forEach((p: any) => {
        // ταιριάζουμε σε ίδια κατηγορία ή αν δεν υπάρχει σε αυτή την κατηγορία, παίρνουμε όποιο βρεθεί
        if (p.category === csvCategory && !nameToId.has(p.name)) nameToId.set(p.name, p.id);
      });
      // fallback: αν ένα όνομα υπάρχει σε άλλη κατηγορία, μην το χρησιμοποιήσεις, φτιάξε νέο
      const toCreate = wantedNames.filter((n) => !nameToId.has(n));
      if (toCreate.length > 0) {
        const newProductsPayload = toCreate.map((n) => {
          const sample = validRows.find((r) => r.product_name === n)!;
          return {
            name: n,
            category: csvCategory,
            vendor: sample.vendor || null,
            sku: sample.sku || null,
            description: null,
          };
        });
        const { data: created, error: cErr } = await supabase
          .from("products")
          .insert(newProductsPayload)
          .select("id, name");
        if (cErr) throw cErr;
        (created ?? []).forEach((p: any) => nameToId.set(p.name, p.id));
      }

      // 2) Insert contracts
      const contractsPayload = validRows.map((r) => ({
        customer_id: csvCustomerId,
        product_id: nameToId.get(r.product_name)!,
        contract_number: r.contract_number,
        quantity: r.quantity,
        unit: r.unit,
        start_date: r.start_date,
        end_date: r.end_date,
        renewal_months: r.renewal_months,
        notes: r.notes || null,
        source: "import" as const,
      }));
      const { error: insErr } = await supabase.from("contracts").insert(contractsPayload);
      if (insErr) throw insErr;
      return { count: contractsPayload.length };
    },
    onSuccess: ({ count }) => {
      toast.success(`Εισήχθησαν ${count} συμβόλαια`);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Αποτυχία import", { description: e.message }),
  });

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contracts-template-${category}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import {categoryMeta[category].label}
          </DialogTitle>
          <DialogDescription>
            Προσθέστε ένα συμβόλαιο γρήγορα ή κάντε bulk import από CSV.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <Plus className="mr-2 h-4 w-4" /> Νέο συμβόλαιο
            </TabsTrigger>
            <TabsTrigger value="csv">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV bulk import
            </TabsTrigger>
          </TabsList>

          {/* ─────────── SINGLE ─────────── */}
          <TabsContent value="single" className="mt-4">
            <form
              onSubmit={(e) => { e.preventDefault(); singleMutation.mutate(form); }}
              className="space-y-4"
            >
              {!customerId && (
                <div>
                  <Label>Πελάτης *</Label>
                  <Select
                    value={form.customer_id}
                    onValueChange={(v) => setForm({ ...form, customer_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Επιλέξτε πελάτη…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Tabs
                value={form.new_product ? "new" : "existing"}
                onValueChange={(v) => setForm({ ...form, new_product: v === "new" })}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Υπάρχον προϊόν</TabsTrigger>
                  <TabsTrigger value="new">Νέο προϊόν</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-3">
                  <Label>Προϊόν *</Label>
                  <Select
                    value={form.product_id}
                    onValueChange={(v) => setForm({ ...form, product_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder={
                      productsInCategory.length === 0 ? "Δεν υπάρχουν προϊόντα — δημιουργήστε νέο" : "Επιλέξτε…"
                    } /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {productsInCategory.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.vendor ? `· ${p.vendor}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="new" className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Όνομα *</Label>
                      <Input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} maxLength={150} />
                    </div>
                    <div>
                      <Label>Vendor</Label>
                      <Input value={form.new_vendor} onChange={(e) => setForm({ ...form, new_vendor: e.target.value })} maxLength={100} />
                    </div>
                    <div>
                      <Label>SKU</Label>
                      <Input value={form.new_sku} onChange={(e) => setForm({ ...form, new_sku: e.target.value })} maxLength={80} />
                    </div>
                    <div>
                      <Label>Κατηγορία</Label>
                      <Input value={categoryMeta[category].label} disabled />
                    </div>
                  </div>
                  <div>
                    <Label>Περιγραφή</Label>
                    <Textarea
                      value={form.new_description}
                      onChange={(e) => setForm({ ...form, new_description: e.target.value })}
                      maxLength={500}
                      rows={2}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Αρ. συμβολαίου *</Label>
                  <Input
                    value={form.contract_number}
                    onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label>Ποσότητα</Label>
                  <Input
                    type="number" min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Μονάδα</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="licenses, units, devices…"
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label>Ανανέωση (μήνες)</Label>
                  <Input
                    type="number" min={1}
                    value={form.renewal_months}
                    onChange={(e) => setForm({ ...form, renewal_months: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Έναρξη *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.start_date ? format(form.start_date, "dd/MM/yyyy") : "Επιλέξτε…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.start_date} onSelect={(d) => setForm({ ...form, start_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Λήξη *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.end_date ? format(form.end_date, "dd/MM/yyyy") : "Επιλέξτε…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.end_date} onSelect={(d) => setForm({ ...form, end_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Σημειώσεις</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={1000}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Άκυρο</Button>
                <Button type="submit" disabled={singleMutation.isPending}>
                  {singleMutation.isPending ? "Αποθήκευση…" : "Δημιουργία"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ─────────── CSV ─────────── */}
          <TabsContent value="csv" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {!customerId && (
                <div>
                  <Label>Πελάτης *</Label>
                  <Select value={csvCustomerId} onValueChange={setCsvCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Επιλέξτε…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Κατηγορία νέων προϊόντων</Label>
                <Select value={csvCategory} onValueChange={(v) => setCsvCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{categoryMeta[c].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Αναμενόμενες στήλες:</p>
              <p className="mt-1 font-mono">{ALL_HEADERS.join(", ")}</p>
              <p className="mt-2">
                Υποχρεωτικά: <span className="font-mono">{REQUIRED_HEADERS.join(", ")}</span>. Ημερομηνίες σε μορφή <span className="font-mono">YYYY-MM-DD</span>.
              </p>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 mt-1" onClick={downloadSample}>
                Κατέβασμα δείγματος CSV
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Ανέβασμα αρχείου</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
              <Label className="mt-3 block">ή επικόλληση CSV</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={6}
                placeholder="contract_number,product_name,vendor,…"
                className="font-mono text-xs"
              />
            </div>

            {parsed?.error && (
              <div className="flex items-start gap-2 rounded-lg border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parsed.error}</span>
              </div>
            )}

            {parsed && !parsed.error && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> {validRows.length} έγκυρες
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-1 font-medium text-brand-red">
                      <AlertCircle className="h-3 w-3" /> {invalidRows.length} με σφάλματα
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60 text-left">
                      <tr>
                        <th className="px-2 py-1.5">#</th>
                        <th className="px-2 py-1.5">Συμβόλαιο</th>
                        <th className="px-2 py-1.5">Προϊόν</th>
                        <th className="px-2 py-1.5">Ποσ.</th>
                        <th className="px-2 py-1.5">Λήξη</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsed.parsedRows.map((r, i) => (
                        <tr key={i} className={r.errors.length > 0 ? "bg-brand-red/5" : ""}>
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 font-mono">{r.contract_number || "—"}</td>
                          <td className="px-2 py-1.5">{r.product_name || "—"}</td>
                          <td className="px-2 py-1.5">{r.quantity}</td>
                          <td className="px-2 py-1.5">{r.end_date || "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.errors.length === 0 ? (
                              <span className="text-emerald-700">OK</span>
                            ) : (
                              <span className="text-brand-red" title={r.errors.join(" · ")}>
                                {r.errors.length} σφάλμα(τα)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Άκυρο</Button>
              <Button
                type="button"
                onClick={() => csvMutation.mutate()}
                disabled={!csvCustomerId || validRows.length === 0 || csvMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {csvMutation.isPending
                  ? "Εισαγωγή…"
                  : `Εισαγωγή ${validRows.length} συμβολαίων`}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
