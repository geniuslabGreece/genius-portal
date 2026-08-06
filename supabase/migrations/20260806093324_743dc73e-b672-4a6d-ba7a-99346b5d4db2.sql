
-- Sync customer_admin role with the profile's company assignment
CREATE OR REPLACE FUNCTION public.sync_customer_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NOT public.is_admin(NEW.id) THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'customer_admin'::public.app_role;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_customer_admin_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_sync_customer_admin ON public.profiles;
CREATE TRIGGER trg_profiles_sync_customer_admin
AFTER INSERT OR UPDATE OF customer_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_admin_role();

-- Backfill: everyone with a company gets customer_admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'customer_admin'::public.app_role
FROM public.profiles p
WHERE p.customer_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill: geniusnet.gr accounts are portal admins
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(split_part(p.email, '@', 2)) = 'geniusnet.gr'
ON CONFLICT (user_id, role) DO NOTHING;

-- Cleanup: no company and not a portal admin -> no customer_admin role
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.id
  AND ur.role = 'customer_admin'::public.app_role
  AND p.customer_id IS NULL
  AND lower(p.email) <> 'john.zontos@gmail.com'
  AND NOT public.is_admin(p.id);
