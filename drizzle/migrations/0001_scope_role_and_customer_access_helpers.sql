CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN
    _user_id = auth.uid()
    OR auth.role() = 'service_role'
    OR current_setting('role', true) IN ('none', 'postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
  THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN
    _user_id = auth.uid()
    OR auth.role() = 'service_role'
    OR current_setting('role', true) IN ('none', 'postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
  THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
  ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_has_customer_access(_user_id uuid, _customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN
    _user_id = auth.uid()
    OR auth.role() = 'service_role'
    OR current_setting('role', true) IN ('none', 'postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
  THEN (
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND customer_id = _customer_id)
    OR EXISTS (SELECT 1 FROM public.user_customer_admins WHERE user_id = _user_id AND customer_id = _customer_id)
  ) ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.user_has_customer_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_customer_access(uuid, uuid) TO authenticated, service_role;