DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Admins or contract holders can view products"
ON public.products FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.product_id = products.id
      AND public.user_has_customer_access(auth.uid(), c.customer_id)
  )
);