CREATE POLICY "Customer admins read own azure settings"
  ON public.customer_azure_ad_settings
  FOR SELECT
  TO authenticated
  USING (
    customer_id = public.current_user_customer_id()
    AND public.has_role(auth.uid(), 'customer_admin')
  );