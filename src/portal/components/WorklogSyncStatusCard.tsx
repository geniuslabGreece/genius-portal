import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type WorklogSyncStatus = "idle" | "running" | "success" | "error";

export interface WorklogSyncResult {
  total?: number;
  upserted?: number;
  linked?: number;
  unlinked?: number;
}

interface Props {
  status: WorklogSyncStatus;
  startedAt: number | null;
  finishedAt: number | null;
  result: WorklogSyncResult | null;
  errorMessage: string | null;
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" })
    : "—";

export function WorklogSyncStatusCard({ status, startedAt, finishedAt, result, errorMessage }: Props) {
  const [elapsed, setElapsed] = useState(0);

  const { data: last } = useQuery({
    queryKey: ["worklogs-last-sync", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_worklogs")
        .select("synced_at")
        .order("synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const { count } = await supabase
        .from("ticket_worklogs")
        .select("id", { count: "exact", head: true });
      return { synced_at: data?.synced_at ?? null, count: count ?? 0 };
    },
  });

  useEffect(() => {
    if (status !== "running" || !startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [status, startedAt]);

  const duration =
    startedAt && finishedAt ? Math.max(1, Math.round((finishedAt - startedAt) / 1000)) : null;

  const meta = {
    idle: { label: "Σε αναμονή", cls: "bg-muted text-muted-foreground", Icon: Clock },
    running: { label: "Τρέχει…", cls: "bg-primary/10 text-primary", Icon: Loader2 },
    success: { label: "Ολοκληρώθηκε", cls: "bg-emerald-500/10 text-emerald-700", Icon: CheckCircle2 },
    error: { label: "Απέτυχε", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  }[status];

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Κατάσταση συγχρονισμού δελτίων</h3>
            <Badge className={`${meta.cls} hover:${meta.cls}`}>
              <meta.Icon className={`mr-1 h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
              {meta.label}
            </Badge>
          </div>

          {status === "running" && (
            <div className="mt-3">
              <Progress value={undefined} className="h-2 animate-pulse" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Άντληση & αποθήκευση δελτίων από SharePoint… ({elapsed}s)
              </p>
            </div>
          )}

          {status === "error" && errorMessage && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Τελευταίος συγχρονισμός</div>
              <div className="mt-0.5 font-medium">{fmt(last?.synced_at ?? null)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Αποθηκευμένα δελτία</div>
              <div className="mt-0.5 font-medium">{last?.count ?? 0}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Τελευταία εκτέλεση</div>
              <div className="mt-0.5 font-medium">
                {result
                  ? `${result.upserted ?? 0}/${result.total ?? 0} · ${result.linked ?? 0} σε tickets`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Διάρκεια</div>
              <div className="mt-0.5 font-medium">{duration ? `${duration}s` : status === "running" ? `${elapsed}s` : "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
