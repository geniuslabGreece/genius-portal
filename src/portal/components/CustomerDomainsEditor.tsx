import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Loader2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface DomainRow {
  id: string;
  domain: string;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.gr", "outlook.com", "outlook.com.gr",
  "live.com", "msn.com", "yahoo.com", "yahoo.gr", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com",
  "zoho.com", "otenet.gr", "hol.gr", "forthnet.gr", "windowslive.com",
]);

const normalize = (raw: string) =>
  raw.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").split("/")[0];

export function CustomerDomainsEditor({
  customerId,
  customerName,
  domains,
  disabled = false,
}: {
  customerId: string;
  customerName: string;
  domains: DomainRow[];
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customer-domains-all"] });

  const addDomain = useMutation({
    mutationFn: async (raw: string) => {
      const domain = normalize(raw);
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        throw new Error("Μη έγκυρο domain (π.χ. company.gr)");
      }
      if (GENERIC_DOMAINS.has(domain)) {
        throw new Error("Τα γενικά domains (gmail, hotmail κ.λπ.) δεν επιτρέπονται");
      }
      if (domains.some((d) => d.domain.toLowerCase() === domain)) {
        throw new Error("Το domain υπάρχει ήδη");
      }
      const { error } = await supabase
        .from("customer_email_domains")
        .insert({ customer_id: customerId, domain });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Το domain προστέθηκε");
      setValue("");
      invalidate();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const removeDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_email_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Το domain αφαιρέθηκε");
      invalidate();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {domains.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      {domains.map((d) => (
        <span
          key={d.id}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
        >
          @{d.domain}
          {!disabled && (
            <button
              type="button"
              title="Αφαίρεση"
              className="rounded-full hover:bg-foreground/10"
              onClick={() => {
                if (confirm(`Αφαίρεση του domain "@${d.domain}";`)) removeDomain.mutate(d.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" title="Προσθήκη domain">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2 p-3" align="start">
            <p className="text-xs font-medium">Νέο email domain για {customerName}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <AtSign className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={value}
                  placeholder="company.gr"
                  className="h-8 pl-7 text-xs"
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addDomain.mutate(value);
                  }}
                />
              </div>
              <Button
                size="sm"
                className="h-8"
                disabled={addDomain.isPending || !value.trim()}
                onClick={() => addDomain.mutate(value)}
              >
                {addDomain.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Προσθήκη"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Οι χρήστες με επιβεβαιωμένο email σε αυτό το domain δένονται αυτόματα στην εταιρεία.
            </p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
