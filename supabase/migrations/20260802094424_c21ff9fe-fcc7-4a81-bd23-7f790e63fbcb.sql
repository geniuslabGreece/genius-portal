CREATE OR REPLACE FUNCTION public.protect_primary_portal_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protected_email text;
BEGIN
  SELECT lower(email) INTO protected_email
  FROM public.profiles
  WHERE id = OLD.user_id;

  IF protected_email = 'john.zontos@gmail.com'
     AND OLD.role IN ('admin'::public.app_role, 'customer_admin'::public.app_role)
     AND (TG_OP = 'DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'The primary portal administrator roles cannot be removed or changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_primary_portal_admin_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_primary_portal_admin_roles() TO service_role;

DROP TRIGGER IF EXISTS protect_primary_portal_admin_roles_trigger ON public.user_roles;
CREATE TRIGGER protect_primary_portal_admin_roles_trigger
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_primary_portal_admin_roles();