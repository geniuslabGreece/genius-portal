import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cloud } from "lucide-react";
import { useAllCustomers } from "@/portal/data/hooks";
import AzureAdPanel from "./AzureAdPanel";

export function AdminAzureAdPanel() {
  const { data: customers = [], isLoading } = useAllCustomers();
  const [customerId, setCustomerId] = useState<string>("");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0078D4]/10 text-[#0078D4]">
            <Cloud className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Πελάτης</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={isLoading ? "Φόρτωση πελατών…" : "Επιλέξτε πελάτη για σύνδεση με Azure AD"} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {customerId ? (
        <AzureAdPanel customerId={customerId} />
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Επιλέξτε πελάτη για να καταχωρήσετε Tenant ID, Application (Client) ID και Client Secret.
        </Card>
      )}
    </div>
  );
}