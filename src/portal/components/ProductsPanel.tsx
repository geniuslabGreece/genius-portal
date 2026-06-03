import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Category, Product, categoryMeta } from "@/portal/data/types";
import { ImportProductsCsvDialog } from "@/portal/components/ImportProductsCsvDialog";
import { usePermissions, NO_PERMISSION_MESSAGE } from "@/portal/auth/permissions";
import { Lock } from "lucide-react";

interface ProductForm {
  name: string;
  category: Category;
  vendor: string;
  sku: string;
  description: string;
}

const emptyForm: ProductForm = {
  name: "",
  category: "software",
  vendor: "",
  sku: "",
  description: "",
};

export function ProductsPanel() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-admin"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  // Count contracts per product (so we can warn before delete)
  const { data: usageMap = {} } = useQuery({
    queryKey: ["product-usage"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("contracts").select("product_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.product_id] = (map[r.product_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.vendor ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const upsert = useMutation({
    mutationFn: async (f: ProductForm) => {
      const payload = {
        name: f.name.trim(),
        category: f.category,
        vendor: f.vendor.trim() || null,
        sku: f.sku.trim() || null,
        description: f.description.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Προϊόν ενημερώθηκε" : "Προϊόν δημιουργήθηκε");
      qc.invalidateQueries({ queryKey: ["products-admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Προϊόν διαγράφηκε");
      qc.invalidateQueries({ queryKey: ["products-admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-usage"] });
    },
    onError: (e: any) =>
      toast.error("Αποτυχία διαγραφής", {
        description: e.message?.includes("foreign")
          ? "Το προϊόν χρησιμοποιείται σε συμβόλαια — διαγράψτε πρώτα τα συμβόλαια."
          : e.message,
      }),
  });

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      vendor: p.vendor ?? "",
      sku: p.sku ?? "",
      description: p.description ?? "",
    });
    setOpen(true);
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  return (
    <Card>
      {!can("products.create") && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-800">
          <Lock className="h-3.5 w-3.5" />
          Λειτουργία ανάγνωσης μόνο. Απαιτείται ρόλος Portal Admin για εισαγωγή/τροποποίηση.
        </div>
      )}
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση ονόματος, vendor ή SKU…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι κατηγορίες</SelectItem>
            {(Object.keys(categoryMeta) as Category[]).map((c) => (
              <SelectItem key={c} value={c}>
                {categoryMeta[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ImportProductsCsvDialog disabled={!can("products.import_csv")} />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} disabled={!can("products.create")}>
              <Plus className="mr-2 h-4 w-4" /> Νέο προϊόν
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Επεξεργασία προϊόντος" : "Νέο προϊόν"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                upsert.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Όνομα *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Κατηγορία *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as Category })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(categoryMeta) as Category[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {categoryMeta[c].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Input
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    placeholder="π.χ. WatchGuard"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>SKU / Κωδικός</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Περιγραφή</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  Άκυρο
                </Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending ? "Αποθήκευση…" : editingId ? "Αποθήκευση" : "Δημιουργία"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Προϊόν</th>
              <th className="px-4 py-3 font-semibold">Κατηγορία</th>
              <th className="px-4 py-3 font-semibold">Vendor</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold text-right">Συμβόλαια</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Φόρτωση…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Δεν υπάρχουν προϊόντα. Πατήστε «Νέο προϊόν» για χειροκίνητη εισαγωγή.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const usage = usageMap[p.id] ?? 0;
              return (
                <tr key={p.id} className="transition hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        "bg-muted text-foreground/80",
                      )}
                    >
                      {categoryMeta[p.category].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.vendor ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{usage}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        disabled={!can("products.update")}
                        title={can("products.update") ? "Επεξεργασία" : NO_PERMISSION_MESSAGE}
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-brand-red"
                        disabled={!can("products.delete")}
                        title={can("products.delete") ? "Διαγραφή" : NO_PERMISSION_MESSAGE}
                        onClick={() => {
                          if (!can("products.delete")) {
                            toast.error(NO_PERMISSION_MESSAGE);
                            return;
                          }
                          const msg = usage > 0
                            ? `Το προϊόν "${p.name}" χρησιμοποιείται σε ${usage} συμβόλαιο(α). Δεν μπορεί να διαγραφεί. Συνέχεια;`
                            : `Διαγραφή του προϊόντος "${p.name}";`;
                          if (confirm(msg)) remove.mutate(p.id);
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
  );
}
