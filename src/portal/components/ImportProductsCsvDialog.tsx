import { useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { Category, categoryMeta } from "@/portal/data/types";
import { cn } from "@/lib/utils";

interface CsvRow {
  name?: string;
  category?: string;
  vendor?: string;
  sku?: string;
  description?: string;
}

interface ParsedRow {
  rowIndex: number;
  name: string;
  category: Category;
  vendor: string | null;
  sku: string | null;
  description: string | null;
  error?: string;
}

const TEMPLATE = `name,category,vendor,sku,description
WatchGuard Firebox T20,hardware,WatchGuard,WGT20,Tabletop firewall για μικρά γραφεία
Microsoft 365 Business Standard,software,Microsoft,M365-BS,Παραγωγικότητα + email
SoftOne ERP Cloud,erp,SoftOne,S1ERP,ERP module
`;

function isValidCategory(v: string): v is Category {
  return ["software", "hardware", "erp", "devices"].includes(v);
}

interface Props {
  disabled?: boolean;
}

export function ImportProductsCsvDialog({ disabled }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const reset = () => {
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const parsed: ParsedRow[] = res.data.map((r, i) => {
          const name = (r.name ?? "").trim();
          const rawCat = (r.category ?? "software").trim().toLowerCase();
          const cat: Category = isValidCategory(rawCat) ? rawCat : "software";
          const errors: string[] = [];
          if (!name) errors.push("Λείπει name");
          if (!isValidCategory(rawCat)) errors.push(`Άκυρη κατηγορία "${rawCat}"`);
          if (name.length > 200) errors.push("Name > 200 χαρακτ.");
          return {
            rowIndex: i + 2, // +2 because header is row 1, data starts at row 2
            name,
            category: cat,
            vendor: r.vendor?.trim() || null,
            sku: r.sku?.trim() || null,
            description: r.description?.trim() || null,
            error: errors.length ? errors.join(", ") : undefined,
          };
        });
        setRows(parsed);
      },
      error: (err) => {
        toast.error("Αποτυχία parsing CSV", { description: err.message });
      },
    });
  };

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) throw new Error("Δεν υπάρχουν έγκυρες γραμμές");
      const payload = validRows.map((r) => ({
        name: r.name,
        category: r.category,
        vendor: r.vendor,
        sku: r.sku,
        description: r.description,
      }));
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      return validRows.length;
    },
    onSuccess: (count) => {
      toast.success(`Εισήχθησαν ${count} προϊόντα`);
      qc.invalidateQueries({ queryKey: ["products-admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error("Αποτυχία εισαγωγής", { description: e.message }),
  });

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" /> Εισαγωγή CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Εισαγωγή προϊόντων από CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Αναμενόμενες στήλες:</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <code className="rounded bg-background px-1 py-0.5">name</code> *,{" "}
              <code className="rounded bg-background px-1 py-0.5">category</code> ({" "}
              {Object.keys(categoryMeta).join(" | ")} ),{" "}
              <code className="rounded bg-background px-1 py-0.5">vendor</code>,{" "}
              <code className="rounded bg-background px-1 py-0.5">sku</code>,{" "}
              <code className="rounded bg-background px-1 py-0.5">description</code>
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={downloadTemplate}
            >
              <Download className="mr-1 h-3 w-3" /> Κατεβάστε template
            </Button>
          </div>

          <div>
            <Label>Αρχείο CSV</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && (
              <p className="mt-1 text-xs text-muted-foreground">
                <FileText className="mr-1 inline h-3 w-3" /> {fileName} — {rows.length} γραμμές
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> {validRows.length} έγκυρα
                </span>
                {invalidRows.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {invalidRows.length} με σφάλμα
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">#</th>
                      <th className="px-2 py-1.5 font-semibold">Name</th>
                      <th className="px-2 py-1.5 font-semibold">Category</th>
                      <th className="px-2 py-1.5 font-semibold">Vendor</th>
                      <th className="px-2 py-1.5 font-semibold">SKU</th>
                      <th className="px-2 py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(r.error && "bg-amber-500/5")}
                      >
                        <td className="px-2 py-1 text-muted-foreground">{r.rowIndex}</td>
                        <td className="px-2 py-1 font-medium">{r.name || "—"}</td>
                        <td className="px-2 py-1">{r.category}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.vendor ?? "—"}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">{r.sku ?? "—"}</td>
                        <td className="px-2 py-1">
                          {r.error ? (
                            <span className="text-amber-700">{r.error}</span>
                          ) : (
                            <span className="text-emerald-700">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Άκυρο
          </Button>
          <Button
            disabled={validRows.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending
              ? "Εισαγωγή…"
              : `Εισαγωγή ${validRows.length} προϊόντων`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}