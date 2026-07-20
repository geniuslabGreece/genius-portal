import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Wrench, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Worklog {
  id: string;
  web_url: string;
  created: string;
  engineer: string | null;
  engineer_email: string | null;
  start: string | null;
  end: string | null;
  hours: number | null;
  duration: string | null;
  method: string | null;
  description: string | null;
  tech_notes: string | null;
  signature: string | null;
  title: string | null;
}

interface Props {
  customerId: string;
  customerName?: string;
}

export function SharePointWorklogsPanel({ customerId, customerName }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sharepoint-worklogs", customerId],
    enabled: !!customerId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sharepoint-worklogs", {
        body: { customer_id: customerId, limit: 50 },
      });
      if (error) {
        const details =
          error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        if (details?.includes("customer_not_found_or_forbidden") || details?.includes("unauthorized")) {
          throw new Error("forbidden");
        }
        throw new Error(details);
      }
      return data as {
        customer: { id: string; name: string; sharepoint_id: number | null };
        matched_by: string | null;
        count: number;
        worklogs: Worklog[];
        message?: string;
      };
    },
  });

  const isForbidden = (error as Error | null)?.message === "forbidden";
  if (isForbidden) return null;


  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">
            Δελτία εργασιών μηχανικών (SharePoint)
          </h3>
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.count} δελτία{data.matched_by ? ` • match: ${data.matched_by}` : ""}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση από SharePoint…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Σφάλμα: {(error as Error).message}
        </div>
      )}

      {data && !data.worklogs.length && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          {data.message ??
            `Δεν βρέθηκαν δελτία για ${customerName ?? "τον πελάτη"} στη λίστα του SharePoint.`}
        </div>
      )}

      {data && data.worklogs.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {data.worklogs.map((w) => (
            <div
              key={w.id}
              className="rounded-md border border-border bg-background p-3 text-sm hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <User className="h-3 w-3" /> {w.engineer ?? "—"}
                </span>
                {w.start && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(w.start).toLocaleString("el-GR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
                {w.hours != null && (
                  <Badge variant="secondary" className="text-[10px]">
                    {w.hours}h
                  </Badge>
                )}
                {w.method && (
                  <Badge variant="outline" className="text-[10px]">
                    {w.method}
                  </Badge>
                )}
                <a
                  href={w.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> SharePoint
                </a>
              </div>
              {w.description && (
                <p className="mt-1.5 whitespace-pre-wrap text-foreground/90">
                  {w.description}
                </p>
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
