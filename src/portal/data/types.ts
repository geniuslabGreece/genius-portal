// Domain types — αντικαθιστούν το src/portal/mockData.ts.
// Συμβατά με το Supabase schema.

export type Category = "software" | "hardware" | "erp" | "devices";
export type ContractStatus = "active" | "expiring_soon" | "critical" | "expired";
export type ContractSource = "manual" | "import" | "softone_sync";
export type NotificationType = "expiring_60" | "expiring_30" | "expiring_7" | "expired" | "general";

export interface Product {
  id: string;
  category: Category;
  name: string;
  vendor: string | null;
  sku: string | null;
  description: string | null;
}

export interface Contract {
  id: string;
  customer_id: string;
  product: Product;
  contract_number: string;
  quantity: number;
  unit: string;
  start_date: string;
  end_date: string;
  renewal_months: number;
  source: ContractSource;
  notes: string | null;
  locked_from_sync: boolean;
}

export interface Customer {
  id: string;
  name: string;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  account_manager_name: string | null;
  account_manager_email: string | null;
  account_manager_phone: string | null;
  status: string;
  notes: string | null;
}

export interface NotificationItem {
  id: string;
  customer_id: string;
  contract_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export const daysUntil = (isoDate: string): number => {
  const end = new Date(isoDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const contractStatus = (c: Contract): ContractStatus => {
  const d = daysUntil(c.end_date);
  if (d < 0) return "expired";
  if (d <= 30) return "critical";
  if (d <= 60) return "expiring_soon";
  return "active";
};

export const categoryMeta: Record<
  Category,
  { label: string; description: string; accent: string }
> = {
  software: {
    label: "Software",
    description: "Άδειες χρήσης, cloud subscriptions, security suites.",
    accent: "primary",
  },
  hardware: {
    label: "Hardware",
    description: "Firewalls, servers, δικτυακός εξοπλισμός, support contracts.",
    accent: "accent",
  },
  erp: {
    label: "ERP",
    description: "Soft1 ERP modules, παραγωγή, CRM, e-Invoicing.",
    accent: "brand-red",
  },
  devices: {
    label: "Devices",
    description: "Laptops, εκτυπωτές, φορητές συσκευές, service contracts.",
    accent: "primary-glow",
  },
};
