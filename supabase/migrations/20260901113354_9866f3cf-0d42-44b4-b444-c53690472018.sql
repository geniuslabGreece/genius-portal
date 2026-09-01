
CREATE OR REPLACE FUNCTION public.is_generic_email_domain(_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(_domain, '')) IN (
    'gmail.com','googlemail.com','hotmail.com','hotmail.gr','outlook.com','outlook.com.gr',
    'live.com','msn.com','yahoo.com','yahoo.gr','icloud.com','me.com','mac.com',
    'aol.com','proton.me','protonmail.com','gmx.com','gmx.net','mail.com','yandex.com',
    'zoho.com','otenet.gr','hol.gr','forthnet.gr','windowslive.com'
  )
$$;

CREATE OR REPLACE FUNCTION public.match_customer_for_domain(_domain text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _domain IS NULL OR _domain = '' OR public.is_generic_email_domain(_domain) THEN NULL
    ELSE COALESCE(
      (SELECT customer_id FROM public.customer_email_domains
        WHERE lower(domain) = lower(_domain) LIMIT 1),
      (SELECT id FROM public.customers
        WHERE email IS NOT NULL
          AND lower(split_part(email, '@', 2)) = lower(_domain)
        LIMIT 1)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.is_generic_email_domain(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_customer_for_domain(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_generic_email_domain(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_customer_for_domain(text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain TEXT;
  _customer_id UUID;
  _is_genius BOOLEAN;
  _verified BOOLEAN;
BEGIN
  _domain := LOWER(SPLIT_PART(NEW.email, '@', 2));
  _is_genius := (_domain = 'geniusnet.gr');
  _verified := NEW.email_confirmed_at IS NOT NULL;

  IF _verified THEN
    _customer_id := public.match_customer_for_domain(_domain);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, customer_id, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _customer_id,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );

  IF _is_genius AND _verified THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain TEXT;
  _customer_id UUID;
BEGIN
  _domain := LOWER(SPLIT_PART(NEW.email, '@', 2));

  IF _domain = 'geniusnet.gr' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  _customer_id := public.match_customer_for_domain(_domain);

  IF _customer_id IS NOT NULL THEN
    -- ο trigger trg_profiles_sync_customer_admin δίνει τον ρόλο customer_admin
    UPDATE public.profiles
      SET customer_id = _customer_id
      WHERE id = NEW.id AND customer_id IS DISTINCT FROM _customer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.handle_user_email_verified();
