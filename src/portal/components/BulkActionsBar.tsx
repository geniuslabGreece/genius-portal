import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, RefreshCw, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

type Mode = null | "extend" | "renewal" | "delete";

export function BulkActionsBar({ selectedIds, onClear }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [renewalMonths, setRenewalMonths] = useState(12);

  const close = () => setMode(null);

  const extend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contracts")
        .update({ end_date: endDate })
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} συμβόλαια ενημερώθηκαν`);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      close();
      onClear();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const updateRenewal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contracts")
        .update({ renewal_months: renewalMonths })
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} συμβόλαια ενημερώθηκαν`);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      close();
      onClear();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contracts").delete().in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} συμβόλαια διαγράφηκαν`);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      close();
      onClear();
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-elegant backdrop-blur">
        <span className="ml-2 text-sm font-medium">
          {selectedIds.length} επιλεγμένα
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setMode("extend")}>
            <CalendarClock className="mr-1.5 h-4 w-4" /> Παράταση
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("renewal")}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Renewal
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-brand-red hover:bg-brand-red/10 hover:text-brand-red"
            onClick={() => setMode("delete")}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Διαγραφή
          </Button>
          <Button size="icon" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={mode === "extend"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Μαζική παράταση — νέο end_date</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Όλα τα {selectedIds.length} επιλεγμένα συμβόλαια θα αποκτήσουν αυτή την ημερομηνία λήξης.
            </p>
            <div>
              <Label>Νέα ημερομηνία λήξης</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Άκυρο</Button>
            <Button onClick={() => extend.mutate()} disabled={extend.isPending}>
              {extend.isPending ? "Αποθήκευση…" : "Εφαρμογή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "renewal"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Μαζική αλλαγή renewal months</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ορισμός κύκλου ανανέωσης για {selectedIds.length} συμβόλαια.
            </p>
            <div>
              <Label>Renewal months</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={renewalMonths}
                onChange={(e) => setRenewalMonths(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Άκυρο</Button>
            <Button onClick={() => updateRenewal.mutate()} disabled={updateRenewal.isPending}>
              {updateRenewal.isPending ? "Αποθήκευση…" : "Εφαρμογή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Μαζική διαγραφή</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Σίγουρα θες να διαγράψεις {selectedIds.length} συμβόλαια; Η ενέργεια δεν αναιρείται.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Άκυρο</Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Διαγραφή…" : "Ναι, διαγραφή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
