export type TicketDepartment = "technical" | "software" | "erp" | "hardware" | "devices";
export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketMessageAuthor = "customer" | "admin" | "ai_bot" | "system";

export const ticketDepartments: Array<{
  value: TicketDepartment;
  label: string;
  description: string;
}> = [
  { value: "technical", label: "Τεχνικό Τμήμα", description: "Δικτύωση, υποδομές, ασφάλεια, on-site" },
  { value: "software", label: "Software", description: "Άδειες, εφαρμογές, cloud subscriptions" },
  { value: "erp", label: "ERP / SoftOne", description: "SoftOne, παραγωγή, CRM, e-Invoicing" },
  { value: "hardware", label: "Hardware", description: "Servers, firewalls, εξοπλισμός" },
  { value: "devices", label: "Συσκευές", description: "Laptops, εκτυπωτές, φορητές συσκευές" },
];

export const ticketStatusMeta: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  open: { label: "Ανοιχτό", className: "bg-amber-500/10 text-amber-700" },
  in_progress: { label: "Σε εξέλιξη", className: "bg-blue-500/10 text-blue-700" },
  waiting_customer: { label: "Αναμονή πελάτη", className: "bg-purple-500/10 text-purple-700" },
  resolved: { label: "Επιλύθηκε", className: "bg-emerald-500/10 text-emerald-700" },
  closed: { label: "Κλειστό", className: "bg-muted text-muted-foreground" },
};

export const priorityMeta: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: "Χαμηλή", className: "bg-muted text-muted-foreground" },
  normal: { label: "Κανονική", className: "bg-blue-500/10 text-blue-700" },
  high: { label: "Υψηλή", className: "bg-orange-500/10 text-orange-700" },
  urgent: { label: "Επείγον", className: "bg-red-500/10 text-red-700" },
};

export const formatTicketDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};