import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowRight, Server, Cpu, Briefcase, Smartphone, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/portal/auth/AuthContext";
import { useContracts, filterByCategory } from "@/portal/data/hooks";
import { Category, categoryMeta, contractStatus, daysUntil } from "@/portal/data/types";
import { ImportContractsDialog } from "@/portal/components/ImportContractsDialog";
import { BulkActionsBar } from "@/portal/components/BulkActionsBar";
import AzureSyncedDevicesCard from "@/portal/components/AzureSyncedDevicesCard";

const ICONS: Record<Category, typeof Server> = {
  software: Server,
  hardware: Cpu,
  erp: Briefcase,
  devices: Smartphone,
};

const statusColor = (status: string) =>
  status === "critical"
    ? "bg-brand-red text-white"
    : status === "expiring_soon"
      ? "bg-amber-500 text-white"
      : status === "expired"
        ? "bg-muted text-muted-foreground"
        : "bg-emerald-500 text-white";

const statusLabel = (status: string) =>
  status === "critical" ? "Critical" : status === "expiring_soon" ? "Λήγει σύντομα" : status === "expired" ? "Έληξε" : "Ενεργό";

interface Props {
  category?: Category;
  title?: string;
}

export default function CategoryView({ category, title }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  // Admins βλέπουν όλα τα συμβόλαια όλων των πελατών — οι customer users μόνο τα δικά τους
  const { data: contracts = [], isLoading } = useContracts(isAdmin ? null : profile?.customer_id);

  const meta = category ? categoryMeta[category] : null;
  const Icon = category ? ICONS[category] : Server;

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"end" | "name" | "vendor">("end");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("filter") === "expiring" ? "expiring" : "all",
  );
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const items = useMemo(() => {
    let list = category ? filterByCategory(contracts, category) : contracts;
    if (statusFilter === "expiring")
      list = list.filter((c) => ["critical", "expiring_soon"].includes(contractStatus(c)));
    if (statusFilter === "active") list = list.filter((c) => contractStatus(c) === "active");
    if (statusFilter === "expired") list = list.filter((c) => contractStatus(c) === "expired");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.product.name.toLowerCase().includes(q) ||
          (c.product.vendor ?? "").toLowerCase().includes(q) ||
          c.contract_number.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.product.name.localeCompare(b.product.name);
      if (sortKey === "vendor") return (a.product.vendor ?? "").localeCompare(b.product.vendor ?? "");
      return daysUntil(a.end_date) - daysUntil(b.end_date);
    });
  }, [contracts, category, search, sortKey, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {category && (
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {category ? "Κατηγορία" : "Συμβόλαια"}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {title ?? meta?.label ?? "Όλα τα συμβόλαια"}
            </h1>
            {meta && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{meta.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && category && (
            <Button onClick={() => setImportOpen(true)} className="shrink-0">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          )}
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-center shadow-soft">
            <p className="font-display text-3xl font-bold leading-none">{items.length}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              συμβόλαια
            </p>
          </div>
        </div>
      </div>

      {category === "devices" && profile?.customer_id && (
        <AzureSyncedDevicesCard customerId={profile.customer_id} />
      )}

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
            <SelectItem value="active">Ενεργά</SelectItem>
            <SelectItem value="expiring">Λήγουν σύντομα</SelectItem>
            <SelectItem value="expired">Ληγμένα</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
          <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="end">Ημ/νία λήξης</SelectItem>
            <SelectItem value="name">Όνομα προϊόντος</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {isAdmin && items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={items.length > 0 && items.every((c) => selected.has(c.id))}
            onCheckedChange={(v) => {
              if (v) setSelected(new Set(items.map((c) => c.id)));
              else setSelected(new Set());
            }}
            aria-label="Επιλογή όλων"
          />
          <span>Επιλογή όλων ({items.length})</span>
        </div>
      )}

      <div className="grid gap-3">
        {isLoading && (
          <Card className="p-12 text-center text-sm text-muted-foreground">Φόρτωση συμβολαίων…</Card>
        )}
        {items.map((c) => {
          const status = contractStatus(c);
          const days = daysUntil(c.end_date);
          const isSelected = selected.has(c.id);
          return (
            <div
              key={c.id}
              className={cn(
                "group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft transition-smooth md:flex-row md:items-center",
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-elegant",
              )}
            >
              {isAdmin && (
                <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelected(c.id)}
                    aria-label="Επιλογή συμβολαίου"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate(`/portal/contracts/${c.id}`)}
                className="flex flex-1 flex-col gap-4 text-left md:flex-row md:items-center"
              >
                <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60 px-4 py-3 md:w-36">
                  <p className="font-display text-2xl font-bold leading-none">{c.quantity}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {c.unit}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{c.product.name}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        statusColor(status),
                      )}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.product.vendor} · {c.contract_number} · ανανέωση κάθε {c.renewal_months} μήνες
                  </p>
                  {c.product.description && (
                    <p className="mt-2 line-clamp-1 text-sm text-foreground/70">{c.product.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:text-right">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(c.end_date).toLocaleDateString("el-GR")}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        status === "critical"
                          ? "text-brand-red"
                          : status === "expiring_soon"
                            ? "text-amber-600"
                            : status === "expired"
                              ? "text-muted-foreground"
                              : "text-emerald-600",
                      )}
                    >
                      {days < 0 ? `έληξε πριν ${Math.abs(days)}η` : `σε ${days} ημέρες`}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
              </button>
            </div>
          );
        })}
        {!isLoading && items.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Δεν βρέθηκαν συμβόλαια με τα παρόντα φίλτρα.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Καθαρισμός φίλτρων
            </Button>
          </Card>
        )}
      </div>

      {category && (
        <ImportContractsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          category={category}
        />
      )}

      {isAdmin && (
        <BulkActionsBar
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
