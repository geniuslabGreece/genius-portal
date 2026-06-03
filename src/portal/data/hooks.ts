// React Query hooks γύρω από το Supabase — αντικαθιστούν το mock data.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/portal/auth/AuthContext";
import {
  Category,
  Contract,
  Customer,
  NotificationItem,
  Product,
  contractStatus,
  daysUntil,
} from "./types";

// ─────────────────────────────────────────────────────────────
// CONTRACTS
// ─────────────────────────────────────────────────────────────
const mapContract = (row: any): Contract => ({
  id: row.id,
  customer_id: row.customer_id,
  contract_number: row.contract_number,
  quantity: row.quantity,
  unit: row.unit,
  start_date: row.start_date,
  end_date: row.end_date,
  renewal_months: row.renewal_months,
  source: row.source,
  notes: row.notes,
  locked_from_sync: row.locked_from_sync,
  product: {
    id: row.products.id,
    category: row.products.category,
    name: row.products.name,
    vendor: row.products.vendor,
    sku: row.products.sku,
    description: row.products.description,
  },
});

export const useContracts = (customerId?: string | null) => {
  return useQuery({
    queryKey: ["contracts", customerId ?? "all"],
    queryFn: async (): Promise<Contract[]> => {
      let q = supabase
        .from("contracts")
        .select("*, products(*)")
        .order("end_date", { ascending: true });
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapContract);
    },
    enabled: customerId !== undefined,
  });
};

export const useContract = (id: string | undefined) => {
  return useQuery({
    queryKey: ["contract", id],
    queryFn: async (): Promise<Contract | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("contracts")
        .select("*, products(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapContract(data) : null;
    },
    enabled: !!id,
  });
};

// ─────────────────────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────────────────────
export const useCurrentCustomer = () => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["customer", profile?.customer_id],
    queryFn: async (): Promise<Customer | null> => {
      if (!profile?.customer_id) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", profile.customer_id)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!profile?.customer_id,
  });
};

export const useAllCustomers = () => {
  return useQuery({
    queryKey: ["customers", "all"],
    queryFn: async (): Promise<Array<Customer & { contract_count: number }>> => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, contracts(count)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        ...(c as Customer),
        contract_count: c.contracts?.[0]?.count ?? 0,
      }));
    },
  });
};

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────
export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
};

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
export const useNotifications = (customerId?: string | null) => {
  return useQuery({
    queryKey: ["notifications", customerId],
    queryFn: async (): Promise<NotificationItem[]> => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationItem[];
    },
    enabled: !!customerId,
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

// ─────────────────────────────────────────────────────────────
// DERIVED
// ─────────────────────────────────────────────────────────────
export const filterByCategory = (contracts: Contract[], cat: Category) =>
  contracts.filter((c) => c.product.category === cat);

export const countActiveByCategory = (contracts: Contract[], cat: Category) =>
  contracts.filter((c) => c.product.category === cat && contractStatus(c) !== "expired").length;

export const upcomingExpirations = (contracts: Contract[], limit = 6) =>
  [...contracts]
    .filter((c) => contractStatus(c) !== "expired")
    .sort((a, b) => daysUntil(a.end_date) - daysUntil(b.end_date))
    .slice(0, limit);

export const criticalContracts = (contracts: Contract[]) =>
  contracts.filter((c) => ["critical", "expiring_soon"].includes(contractStatus(c)));
