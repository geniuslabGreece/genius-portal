CREATE TABLE IF NOT EXISTS public.mail_server_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'none',
  enabled boolean NOT NULL DEFAULT false,
  from_email text,
  from_name text,
  reply_to text,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean NOT NULL DEFAULT true,
  smtp_username text,
  smtp_password text,
  oauth_client_id text,
  oauth_client_secret text,
  oauth_refresh_token text,
  oauth_tenant_id text,
  last_test_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mail_server_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mail server settings"
ON public.mail_server_settings
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_mail_server_settings_updated
BEFORE UPDATE ON public.mail_server_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.mail_server_settings (provider) VALUES ('none');