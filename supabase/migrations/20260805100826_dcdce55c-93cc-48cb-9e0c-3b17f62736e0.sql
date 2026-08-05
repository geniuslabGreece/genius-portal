CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _domain TEXT;
  _customer_id UUID;
  _is_genius BOOLEAN;
BEGIN
  _domain := LOWER(SPLIT_PART(NEW.email, '@', 2));
  _is_genius := (_domain = 'geniusnet.gr');

  SELECT customer_id INTO _customer_id
  FROM public.customer_email_domains
  WHERE LOWER(domain) = _domain
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, customer_id, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _customer_id,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );

  IF _is_genius THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Κάθε χρήστης γίνεται admin ΜΟΝΟ για τη δική του εταιρεία
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Αναβάθμιση υπαρχόντων χρηστών που ανήκουν σε εταιρεία
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'customer_admin'::public.app_role
FROM public.profiles p
WHERE p.customer_id IS NOT NULL
  AND NOT public.is_admin(p.id)
ON CONFLICT (user_id, role) DO NOTHING;