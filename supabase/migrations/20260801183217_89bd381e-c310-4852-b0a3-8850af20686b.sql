DROP POLICY IF EXISTS "Customer admins manage own role mappings" ON public.customer_azure_ad_role_mappings;

CREATE POLICY "Customer admins view own role mappings"
ON public.customer_azure_ad_role_mappings
FOR SELECT TO authenticated
USING (public.is_customer_admin_for(auth.uid(), customer_id));

CREATE POLICY "Customer admins insert own role mappings"
ON public.customer_azure_ad_role_mappings
FOR INSERT TO authenticated
WITH CHECK (
  public.is_customer_admin_for(auth.uid(), customer_id)
  AND role <> 'admin'::app_role
);

CREATE POLICY "Customer admins update own role mappings"
ON public.customer_azure_ad_role_mappings
FOR UPDATE TO authenticated
USING (
  public.is_customer_admin_for(auth.uid(), customer_id)
  AND role <> 'admin'::app_role
)
WITH CHECK (
  public.is_customer_admin_for(auth.uid(), customer_id)
  AND role <> 'admin'::app_role
);

CREATE POLICY "Customer admins delete own role mappings"
ON public.customer_azure_ad_role_mappings
FOR DELETE TO authenticated
USING (
  public.is_customer_admin_for(auth.uid(), customer_id)
  AND role <> 'admin'::app_role
);