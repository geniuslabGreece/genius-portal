import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Calendar, Mail, Phone, RefreshCw, FileText,
  CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useContract, useCurrentCustomer } from "@/portal/data/hooks";
import { contractStatus, daysUntil } from "@/portal/data/types";

const statusBadgeFull = (status: string) => {
  if (status === "critical")
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red"><AlertTriangle className="h-3.5 w-3.5" /> Critical — άμεση ενέργεια</span>;
  if (status === "expiring_soon")
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700"><Clock className="h-3.5 w-3.5" /> Λήγει σύντομα</span>;
  if (status === "expired")
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Έληξε</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Ενεργό</span>;
};

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: c, isLoading } = useContract(id);
  const { data: customer } = useCurrentCustomer();

  if (isLoading) {
    return <Card className="p-12 text-center text-sm text-muted-foreground">Φόρτωση…</Card>;
  }

  if (!c) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">Δεν βρέθηκε συμβόλαιο.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/portal")}>
          Επιστροφή στο Dashboard
        </Button>
      </Card>
    );
  }

  const status = contractStatus(c);
  const days = daysUntil(c.end_date);
  const start = new Date(c.start_date).getTime();
  const end = new Date(c.end_date).getTime();
  const now = Date.now();
  const totalDays = Math.max(1, (end - start) / 86400000);
  const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const elapsedDays = Math.round((now - start) / 86400000);
  const am = customer ? {
    name: customer.account_manager_name,
    email: customer.account_manager_email,
    phone: customer.account_manager_phone,
  } : null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Πίσω
      </button>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {c.product.vendor} · {c.product.category}
              </p>
              {statusBadgeFull(status)}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {c.product.name}
            </h1>
            {c.product.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{c.product.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <Button className="bg-brand-red text-white hover:bg-brand-red/90">
              <RefreshCw className="mr-2 h-4 w-4" />
              Αίτημα ανανέωσης
            </Button>
            {am?.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${am.email}?subject=Συμβόλαιο ${c.contract_number}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Επικοινωνία με Account Manager
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="bg-muted/30 px-6 py-6">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Έναρξη {new Date(c.start_date).toLocaleDateString("el-GR")}</span>
            <span className="font-semibold text-foreground">
              {Math.max(0, elapsedDays)} / {Math.round(totalDays)} ημέρες
            </span>
            <span>Λήξη {new Date(c.end_date).toLocaleDateString("el-GR")}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                status === "critical" ? "bg-gradient-to-r from-brand-red/70 to-brand-red"
                  : status === "expiring_soon" ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : status === "expired" ? "bg-muted-foreground/40"
                      : "bg-gradient-to-r from-accent to-primary",
              )}
              style={{ width: `${Math.round(elapsed * 100)}%` }}
            />
            <div
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-foreground shadow-md"
              style={{ left: `${Math.round(elapsed * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-center text-sm">
            {days < 0 ? (
              <span className="text-muted-foreground">
                Έληξε πριν <span className="font-semibold">{Math.abs(days)}</span> ημέρες
              </span>
            ) : (
              <>
                <span className={cn("font-bold",
                  status === "critical" ? "text-brand-red"
                    : status === "expiring_soon" ? "text-amber-600" : "text-foreground")}>
                  {days}
                </span>
                <span className="text-muted-foreground"> ημέρες έως τη λήξη</span>
              </>
            )}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
            <FileText className="h-4 w-4 text-accent" />
            Στοιχεία συμβολαίου
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {[
              ["Vendor", c.product.vendor ?? "—"],
              ["Κατηγορία", c.product.category.toUpperCase()],
              ["SKU / Model", c.product.sku ?? "—"],
              ["Ποσότητα", `${c.quantity} ${c.unit}`],
              ["Αριθμός συμβολαίου", c.contract_number],
              ["Πηγή δεδομένων", c.source === "manual" ? "Manual entry" : c.source === "softone_sync" ? "Softone sync" : "Import"],
              ["Έναρξη", new Date(c.start_date).toLocaleDateString("el-GR")],
              ["Λήξη", new Date(c.end_date).toLocaleDateString("el-GR")],
              ["Περίοδος ανανέωσης", `${c.renewal_months} μήνες`],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-border pb-3 last:border-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          {c.notes && (
            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Σημειώσεις</p>
              <p className="mt-1.5 text-sm text-foreground">{c.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
            <Calendar className="h-4 w-4 text-accent" />
            Ιστορικό ειδοποιήσεων
          </h2>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {[
              { d: "T-60", label: "60 ημέρες πριν τη λήξη", sent: days <= 60 || days < 0, kind: "info" },
              { d: "T-30", label: "30 ημέρες πριν τη λήξη", sent: days <= 30 || days < 0, kind: "warn" },
              { d: "T-7", label: "7 ημέρες πριν τη λήξη", sent: days <= 7 || days < 0, kind: "crit" },
              { d: "T-0", label: "Ημέρα λήξης", sent: days <= 0, kind: "crit" },
            ].map((step) => (
              <li key={step.d} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background",
                    step.sent
                      ? step.kind === "crit" ? "bg-brand-red"
                        : step.kind === "warn" ? "bg-amber-500" : "bg-accent"
                      : "bg-border",
                  )}
                />
                <p className={cn("text-xs font-semibold uppercase tracking-wider",
                  step.sent ? "text-foreground" : "text-muted-foreground")}>
                  {step.d}
                </p>
                <p className="text-xs text-muted-foreground">{step.label}</p>
                <p className={cn("mt-0.5 text-[11px]",
                  step.sent ? "text-emerald-600" : "text-muted-foreground/60")}>
                  {step.sent ? "✓ Στάλθηκε" : "Προγραμματισμένο"}
                </p>
              </li>
            ))}
          </ol>

          {am?.name && (
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Account Manager
              </p>
              <p className="mt-1 text-sm font-semibold">{am.name}</p>
              {am.email && (
                <a href={`mailto:${am.email}`} className="mt-2 flex items-center gap-2 text-xs text-accent hover:underline">
                  <Mail className="h-3.5 w-3.5" />{am.email}
                </a>
              )}
              {am.phone && (
                <a href={`tel:${am.phone}`} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{am.phone}
                </a>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
