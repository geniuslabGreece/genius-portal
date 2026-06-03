
-- Settings table (per customer)
CREATE TABLE public.customer_azure_ad_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_azure_ad_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage azure ad settings"
  ON public.customer_azure_ad_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_customer_azure_ad_settings_updated_at
  BEFORE UPDATE ON public.customer_azure_ad_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cached users
CREATE TABLE public.customer_azure_ad_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  azure_object_id TEXT NOT NULL,
  display_name TEXT,
  mail TEXT,
  user_principal_name TEXT,
  job_title TEXT,
  account_enabled BOOLEAN,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, azure_object_id)
);

CREATE INDEX idx_azure_users_customer ON public.customer_azure_ad_users(customer_id);

ALTER TABLE public.customer_azure_ad_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all azure users"
  ON public.customer_azure_ad_users FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Customer users read own azure users"
  ON public.customer_azure_ad_users FOR SELECT TO authenticated
  USING (customer_id = public.current_user_customer_id());

CREATE POLICY "Admins write azure users"
  ON public.customer_azure_ad_users FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Cached devices
CREATE TABLE public.customer_azure_ad_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  azure_device_id TEXT NOT NULL,
  display_name TEXT,
  operating_system TEXT,
  operating_system_version TEXT,
  trust_type TEXT, -- AzureAd | ServerAd | Workplace
  join_type TEXT,  -- "joined" | "registered" (derived)
  registration_datetime TIMESTAMPTZ,
  approximate_last_sign_in TIMESTAMPTZ,
  is_compliant BOOLEAN,
  is_managed BOOLEAN,
  account_enabled BOOLEAN,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, azure_device_id)
);

CREATE INDEX idx_azure_devices_customer ON public.customer_azure_ad_devices(customer_id);

ALTER TABLE public.customer_azure_ad_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all azure devices"
  ON public.customer_azure_ad_devices FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Customer users read own azure devices"
  ON public.customer_azure_ad_devices FOR SELECT TO authenticated
  USING (customer_id = public.current_user_customer_id());

CREATE POLICY "Admins write azure devices"
  ON public.customer_azure_ad_devices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
