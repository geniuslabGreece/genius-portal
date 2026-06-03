
-- 1. Many-to-many: users ↔ customers for customer_admin scope
CREATE TABLE IF NOT EXISTS public.user_customer_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, customer_id)
);

ALTER TABLE public.user_customer_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_customer_admins"
  ON public.user_customer_admins FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users view own assignments"
  ON public.user_customer_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_customer_admins_user ON public.user_customer_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_customer_admins_customer ON public.user_customer_admins(customer_id);

-- 2. Helper: does this user admin this customer? (via mapping table OR legacy profile.customer_id with customer_admin role)
CREATE OR REPLACE FUNCTION public.is_customer_admin_for(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_customer_admins
      WHERE user_id = _user_id AND customer_id = _customer_id
    )
    OR (
      public.has_role(_user_id, 'customer_admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND customer_id = _customer_id
      )
    )
$$;

-- 3. Update RLS on Azure AD tables to use the new helper
-- customer_azure_ad_settings
DROP POLICY IF EXISTS "Customer admins read own azure settings" ON public.customer_azure_ad_settings;
CREATE POLICY "Customer admins read scoped azure settings"
  ON public.customer_azure_ad_settings FOR SELECT TO authenticated
  USING (public.is_customer_admin_for(auth.uid(), customer_id));

-- customer_azure_ad_users
DROP POLICY IF EXISTS "Customer users read own azure users" ON public.customer_azure_ad_users;
CREATE POLICY "Scoped read azure users"
  ON public.customer_azure_ad_users FOR SELECT TO authenticated
  USING (
    customer_id = public.current_user_customer_id()
    OR public.is_customer_admin_for(auth.uid(), customer_id)
  );

-- customer_azure_ad_devices
DROP POLICY IF EXISTS "Customer users read own azure devices" ON public.customer_azure_ad_devices;
CREATE POLICY "Scoped read azure devices"
  ON public.customer_azure_ad_devices FOR SELECT TO authenticated
  USING (
    customer_id = public.current_user_customer_id()
    OR public.is_customer_admin_for(auth.uid(), customer_id)
  );

-- customer_azure_ad_licenses
DROP POLICY IF EXISTS "Customer users read own azure licenses" ON public.customer_azure_ad_licenses;
CREATE POLICY "Scoped read azure licenses"
  ON public.customer_azure_ad_licenses FOR SELECT TO authenticated
  USING (
    customer_id = public.current_user_customer_id()
    OR public.is_customer_admin_for(auth.uid(), customer_id)
  );

-- customer_azure_ad_sync_logs
DROP POLICY IF EXISTS "Customer users view own azure sync logs" ON public.customer_azure_ad_sync_logs;
CREATE POLICY "Scoped read azure sync logs"
  ON public.customer_azure_ad_sync_logs FOR SELECT TO authenticated
  USING (
    customer_id = public.current_user_customer_id()
    OR public.is_customer_admin_for(auth.uid(), customer_id)
  );
