
-- 1) Profile customer_id takeover fix
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND customer_id IS NOT DISTINCT FROM (
      SELECT p.customer_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 2) Storage RLS for private 'mygn' bucket — admin-only access
DROP POLICY IF EXISTS "Admins read mygn bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins write mygn bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins update mygn bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete mygn bucket" ON storage.objects;

CREATE POLICY "Admins read mygn bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mygn' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins write mygn bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mygn' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update mygn bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mygn' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'mygn' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete mygn bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mygn' AND public.is_admin(auth.uid()));

-- 3) Re-scope sensitive table policies from public to authenticated
-- customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customer" ON public.customers;
CREATE POLICY "Admins can manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their own customer" ON public.customers
  FOR SELECT TO authenticated
  USING ((id = public.current_user_customer_id()) OR public.is_admin(auth.uid()));

-- contracts
DROP POLICY IF EXISTS "Admins can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view their customer's contracts" ON public.contracts;
CREATE POLICY "Admins can manage contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their customer's contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING ((customer_id = public.current_user_customer_id()) OR public.is_admin(auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can mark their notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their customer's notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can mark their notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (customer_id = public.current_user_customer_id());
CREATE POLICY "Users can view their customer's notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((customer_id = public.current_user_customer_id()) OR public.is_admin(auth.uid()));

-- customer_email_domains
DROP POLICY IF EXISTS "Admins can manage email domains" ON public.customer_email_domains;
DROP POLICY IF EXISTS "Users can view their customer's domains" ON public.customer_email_domains;
CREATE POLICY "Admins can manage email domains" ON public.customer_email_domains
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their customer's domains" ON public.customer_email_domains
  FOR SELECT TO authenticated
  USING (customer_id = public.current_user_customer_id());

-- profiles (other policies)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR public.is_admin(auth.uid()));

-- user_roles: split to explicit restrictive policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()));
