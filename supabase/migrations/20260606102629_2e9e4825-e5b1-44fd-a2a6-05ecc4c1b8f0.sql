-- Cache table for Azure AD groups per customer
CREATE TABLE IF NOT EXISTS public.customer_azure_ad_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  azure_group_id TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  mail_enabled BOOLEAN DEFAULT false,
  security_enabled BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, azure_group_id)
);

GRANT SELECT ON public.customer_azure_ad_groups TO authenticated;
GRANT ALL ON public.customer_azure_ad_groups TO service_role;

ALTER TABLE public.customer_azure_ad_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all azure groups"
  ON public.customer_azure_ad_groups FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Customer admins read own azure groups"
  ON public.customer_azure_ad_groups FOR SELECT
  TO authenticated
  USING (public.is_customer_admin_for(auth.uid(), customer_id));

CREATE TRIGGER trg_azure_groups_updated_at
  BEFORE UPDATE ON public.customer_azure_ad_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mapping: Azure group → portal role (per customer)
CREATE TABLE IF NOT EXISTS public.customer_azure_ad_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  azure_group_id TEXT NOT NULL,
  azure_group_name TEXT,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (customer_id, azure_group_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_azure_ad_role_mappings TO authenticated;
GRANT ALL ON public.customer_azure_ad_role_mappings TO service_role;

ALTER TABLE public.customer_azure_ad_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all role mappings"
  ON public.customer_azure_ad_role_mappings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Customer admins manage own role mappings"
  ON public.customer_azure_ad_role_mappings FOR ALL
  TO authenticated
  USING (public.is_customer_admin_for(auth.uid(), customer_id))
  WITH CHECK (public.is_customer_admin_for(auth.uid(), customer_id));

CREATE TRIGGER trg_azure_role_mappings_updated_at
  BEFORE UPDATE ON public.customer_azure_ad_role_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track group membership on user cache
ALTER TABLE public.customer_azure_ad_users
  ADD COLUMN IF NOT EXISTS azure_group_ids TEXT[] DEFAULT '{}';
