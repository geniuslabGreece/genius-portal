CREATE TABLE public.customer_azure_ad_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  sku_id TEXT NOT NULL,
  sku_part_number TEXT,
  display_name TEXT,
  applies_to TEXT,
  capability_status TEXT,
  prepaid_enabled INTEGER,
  prepaid_suspended INTEGER,
  prepaid_warning INTEGER,
  consumed_units INTEGER,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_caz_licenses_customer ON public.customer_azure_ad_licenses(customer_id);

ALTER TABLE public.customer_azure_ad_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage azure licenses"
  ON public.customer_azure_ad_licenses
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Customer users read own azure licenses"
  ON public.customer_azure_ad_licenses
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_user_customer_id());

ALTER TABLE public.customer_azure_ad_sync_logs
  ADD COLUMN IF NOT EXISTS licenses_synced INTEGER DEFAULT 0;