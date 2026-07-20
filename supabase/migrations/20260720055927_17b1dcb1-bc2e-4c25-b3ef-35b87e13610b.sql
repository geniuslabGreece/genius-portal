
CREATE OR REPLACE FUNCTION public.user_has_customer_access(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND customer_id = _customer_id)
    OR EXISTS (SELECT 1 FROM public.user_customer_admins WHERE user_id = _user_id AND customer_id = _customer_id)
$$;

DROP POLICY IF EXISTS "Users can view their own customer" ON public.customers;
CREATE POLICY "Users can view accessible customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.user_has_customer_access(auth.uid(), id));
