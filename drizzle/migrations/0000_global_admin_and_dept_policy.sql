DROP POLICY IF EXISTS "Anyone authenticated can view departments" ON public.ticket_department_settings;

CREATE OR REPLACE FUNCTION public.keep_portal_admin_unbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'john.zontos@gmail.com' THEN
    NEW.customer_id := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.keep_portal_admin_unbound() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_keep_portal_admin_unbound ON public.profiles;
CREATE TRIGGER trg_profiles_keep_portal_admin_unbound
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.keep_portal_admin_unbound();

UPDATE public.profiles SET customer_id = NULL WHERE lower(email) = 'john.zontos@gmail.com';