import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Server,
  Cpu,
  Briefcase,
  Smartphone,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/portal/auth/AuthContext";
import {
  useContracts,
  useCurrentCustomer,
  countActiveByCategory,
  criticalContracts,
  upcomingExpirations,
} from "@/portal/data/hooks";
import { contractStatus, daysUntil } from "@/portal/data/types";

const CATEGORIES = [
  { key: "software" as const, label: "Software", icon: Server, description: "Άδειες & cloud subscriptions", accentClass: "from-primary to-accent", iconBg: "bg-primary/10 text-primary" },
  { key: "hardware" as const, label: "Hardware", icon: Cpu, description: "Firewalls, servers, networking", accentClass: "from-accent to-primary-glow", iconBg: "bg-accent/10 text-accent" },
  { key: "erp" as const, label: "ERP", icon: Briefcase, description: "Soft1 modules & integrations", accentClass: "from-brand-red to-brand-red", iconBg: "bg-brand-red/10 text-brand-red" },
  { key: "devices" as const, label: "Devices", icon: Smartphone, description: "Laptops, εκτυπωτές, φορητά", accentClass: "from-primary-glow to-primary", iconBg: "bg-primary-glow/10 text-primary-glow" },
];

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: "Critical", cls: "bg-brand-red/10 text-brand-red border-brand-red/20" },
    expiring_soon: { label: "Λήγει σύντομα", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    active: { label: "Ενεργό", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    expired: { label: "Έληξε", cls: "bg-muted text-muted-foreground border-border" },
  };
  const { label, cls } = map[status] ?? map.active;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: customer, isLoading: custLoading } = useCurrentCustomer();
  const { data: contracts = [], isLoading: contractsLoading } = useContracts(profile?.customer_id);

  const critical = criticalContracts(contracts);
  const upcoming = upcomingExpirations(contracts);
  const totalActive = contracts.filter((c) => contractStatus(c) !== "expired").length;

  // Empty state: ο χρήστης δεν είναι ακόμα συνδεδεμένος με customer
  if (!profile?.customer_id && !custLoading) {
    return (
      <Card className="p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="mt-5 font-display text-xl font-bold">Δεν έχετε ακόμα ανατεθεί σε εταιρεία</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Ο διαχειριστής της GeniusNet θα σας συνδέσει σύντομα με την εταιρεία σας.
          Στο μεταξύ μπορείτε να ενημερώσετε τα στοιχεία λογαριασμού σας.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => navigate("/portal/account")}>
          Στοιχεία λογαριασμού
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          Email: <span className="font-mono text-foreground">{profile?.email}</span>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Καλώς ήρθατε
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {customer?.name ?? "..."}
          </h1>
          {customer && (
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.vat_number && `ΑΦΜ ${customer.vat_number} · `}
              {totalActive} ενεργά συμβόλαια
            </p>
          )}
        </div>
        {customer?.account_manager_email && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${customer.account_manager_email}`}>
                <Mail className="mr-2 h-4 w-4" />
                Email Account Manager
              </a>
            </Button>
            {customer.account_manager_phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${customer.account_manager_phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Κλήση
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {contractsLoading && (
        <Card className="p-10 text-center text-sm text-muted-foreground">Φόρτωση συμβολαίων…</Card>
      )}

      {/* Empty state */}
      {!contractsLoading && contracts.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Δεν υπάρχουν ακόμα συμβόλαια καταχωρημένα για την εταιρεία σας.
          </p>
        </Card>
      )}

      {/* Critical alert */}
      {critical.length > 0 && (
        <Card className="overflow-hidden border-brand-red/30 bg-gradient-to-r from-brand-red/5 to-brand-red/[0.02]">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-red/15 text-brand-red">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  {critical.length} συμβόλαια λήγουν εντός 60 ημερών
                </p>
                <p className="text-sm text-muted-foreground">
                  Επικοινωνήστε εγκαίρως με τον Account Manager σας για ανανέωση.
                </p>
              </div>
            </div>
            <Button
              variant="default"
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => navigate("/portal/contracts?filter=expiring")}
            >
              Δείτε τα συμβόλαια
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Categories */}
      {contracts.length > 0 && (
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Κατηγορίες προϊόντων</h2>
            <span className="text-xs text-muted-foreground">Ενεργά συμβόλαια ανά κατηγορία</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const count = countActiveByCategory(contracts, cat.key);
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  onClick={() => navigate(`/portal/${cat.key}`)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
                >
                  <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80", cat.accentClass)} />
                  <div className="flex items-start justify-between">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-xl", cat.iconBg)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </div>
                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-foreground">
                    {count}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{cat.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Two columns */}
      {contracts.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                <h2 className="font-display text-base font-semibold">Επόμενες λήξεις</h2>
              </div>
              <button
                onClick={() => navigate("/portal/contracts")}
                className="text-xs font-medium text-accent hover:underline"
              >
                Δείτε όλα →
              </button>
            </div>
            <div className="divide-y divide-border">
              {upcoming.map((c) => {
                const days = daysUntil(c.end_date);
                const status = contractStatus(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/portal/contracts/${c.id}`)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{c.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.product.vendor} · {c.quantity} {c.unit} · {c.contract_number}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(c.end_date).toLocaleDateString("el-GR")}
                      </p>
                      <p className="text-xs text-muted-foreground">σε {days} ημέρες</p>
                    </div>
                    <div className="w-28 text-right">{statusBadge(status)}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-semibold">Επισκόπηση</h2>
            </div>

            <div className="mt-5 space-y-5">
              {[
                { label: "Ενεργά", value: contracts.filter((c) => contractStatus(c) === "active").length, color: "bg-emerald-500" },
                { label: "Λήγουν σύντομα", value: contracts.filter((c) => contractStatus(c) === "expiring_soon").length, color: "bg-amber-500" },
                { label: "Critical (≤30 ημέρες)", value: contracts.filter((c) => contractStatus(c) === "critical").length, color: "bg-brand-red" },
              ].map((s) => {
                const pct = totalActive > 0 ? (s.value / totalActive) * 100 : 0;
                return (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold text-foreground">{s.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all", s.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {upcoming[0] && (
              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Επόμενη λήξη
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{upcoming[0].product.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  σε {daysUntil(upcoming[0].end_date)} ημέρες ·{" "}
                  {new Date(upcoming[0].end_date).toLocaleDateString("el-GR")}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
