import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Wrench, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  ticketId: string;
  customerId: string;
  customerName?: string;
}

export function SharePointWorklogsPanel({ ticketId, customerId, customerName }: Props) {
  const { data: worklogs = [], isLoading, error } = useQuery({
    queryKey: ["ticket-worklogs", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_worklogs")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("start_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">
            Δελτία εργασιών μηχανικών (SharePoint)
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {worklogs.length} δελτία συνδεδεμένα
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Σφάλμα: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && worklogs.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Δεν υπάρχουν συνδεδεμένα δελτία για αυτό το ticket
          {customerName ? ` (${customerName})` : ""}. Τρέξτε «Συγχρονισμός δελτίων» από το Admin → SharePoint,
          ή αναφέρετε το ticket στο SharePoint με τη μορφή <code>#{ticketId.slice(0, 4)}</code>.
        </div>
      )}

      {worklogs.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {worklogs.map((w: any) => (
            <div
              key={w.id}
              className="rounded-md border border-border bg-background p-3 text-sm hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <User className="h-3 w-3" /> {w.engineer ?? "—"}
                </span>
                {w.start_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(w.start_at).toLocaleString("el-GR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
                {w.hours != null && (
                  <Badge variant="secondary" className="text-[10px]">{w.hours}h</Badge>
                )}
                {w.method && (
                  <Badge variant="outline" className="text-[10px]">{w.method}</Badge>
                )}
                {w.web_url && (
                  <a
                    href={w.web_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> SharePoint
                  </a>
                )}
              </div>
              {w.description && (
                <p className="mt-1.5 whitespace-pre-wrap text-foreground/90">{w.description}</p>
              )}
              {w.tech_notes && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  Σχόλια τεχνικού: {w.tech_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
