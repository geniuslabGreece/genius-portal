CREATE OR REPLACE FUNCTION public.keep_portal_admin_unbound() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) IN ('john.zontos@gmail.com','johnz@geniusnet.gr') THEN
    NEW.customer_id := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_primary_portal_admin_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE protected_email text;
BEGIN
  SELECT lower(email) INTO protected_email FROM public.profiles WHERE id = OLD.user_id;
  IF protected_email IN ('john.zontos@gmail.com','johnz@geniusnet.gr')
     AND OLD.role IN ('admin'::public.app_role, 'customer_admin'::public.app_role)
     AND (TG_OP = 'DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'The primary portal administrator roles cannot be removed or changed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.keep_portal_admin_unbound() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_primary_portal_admin_roles() FROM PUBLIC, anon, authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r::public.app_role FROM auth.users u, unnest(array['admin','customer_admin','customer_user']) r
WHERE lower(u.email) = 'johnz@geniusnet.gr'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles SET customer_id = NULL WHERE lower(email) = 'johnz@geniusnet.gr';