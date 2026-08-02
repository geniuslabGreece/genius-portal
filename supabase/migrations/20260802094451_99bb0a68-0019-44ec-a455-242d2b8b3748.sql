CREATE OR REPLACE FUNCTION public.is_customer_admin_for(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_customer_admins
      WHERE user_id = _user_id AND customer_id = _customer_id
    )
    OR (
      public.has_role(_user_id, 'customer_admin'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND customer_id = _customer_id
      )
    )
$$;