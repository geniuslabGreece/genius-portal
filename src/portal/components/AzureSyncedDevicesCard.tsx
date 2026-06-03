import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Laptop } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  customerId: string;
}

export default function AzureSyncedDevicesCard({ customerId }: Props) {
  const { data: devices = [] } = useQuery({
    queryKey: ["azure-ad-devices", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_azure_ad_devices")
        .select("*")
        .eq("customer_id", customerId)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!customerId,
  });

  if (devices.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0078D4]/10 text-[#0078D4]">
          <Cloud className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Microsoft Entra ID
          </p>
          <h2 className="font-display text-lg font-bold">
            Συσκευές οργανισμού ({devices.length})
          </h2>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Συσκευή</th>
              <th className="px-3 py-2 font-semibold">OS</th>
              <th className="px-3 py-2 font-semibold">Τύπος</th>
              <th className="px-3 py-2 font-semibold">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {devices.map((d: any) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                    {d.display_name ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.operating_system ?? "—"} {d.operating_system_version ?? ""}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={d.join_type === "joined" ? "default" : "outline"}>
                    {d.join_type === "joined"
                      ? "Azure AD Joined"
                      : d.join_type === "registered"
                      ? "Azure AD Registered"
                      : d.trust_type ?? "—"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {d.is_compliant === true ? (
                    <Badge className="bg-emerald-500/10 text-emerald-700">Compliant</Badge>
                  ) : d.is_compliant === false ? (
                    <Badge variant="destructive">Non-compliant</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
