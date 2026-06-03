
CREATE OR REPLACE FUNCTION public.validate_mail_server_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  email_re TEXT := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
BEGIN
  -- Provider must be valid
  IF NEW.provider NOT IN ('none','google','microsoft','custom') THEN
    RAISE EXCEPTION 'Invalid provider: %', NEW.provider;
  END IF;

  -- From email always required & valid
  IF NEW.from_email IS NULL OR NEW.from_email !~* email_re THEN
    RAISE EXCEPTION 'A valid from_email is required';
  END IF;

  IF NEW.reply_to IS NOT NULL AND NEW.reply_to <> '' AND NEW.reply_to !~* email_re THEN
    RAISE EXCEPTION 'reply_to is not a valid email';
  END IF;

  IF NEW.enabled THEN
    IF NEW.provider = 'none' THEN
      RAISE EXCEPTION 'Cannot enable mail server with provider = none';
    END IF;

    IF NEW.provider = 'google' THEN
      IF coalesce(NEW.oauth_client_id,'') = '' OR
         coalesce(NEW.oauth_client_secret,'') = '' OR
         coalesce(NEW.oauth_refresh_token,'') = '' THEN
        RAISE EXCEPTION 'Google provider requires oauth_client_id, oauth_client_secret and oauth_refresh_token';
      END IF;
    ELSIF NEW.provider = 'microsoft' THEN
      IF coalesce(NEW.oauth_tenant_id,'') = '' OR
         coalesce(NEW.oauth_client_id,'') = '' OR
         coalesce(NEW.oauth_client_secret,'') = '' THEN
        RAISE EXCEPTION 'Microsoft provider requires oauth_tenant_id, oauth_client_id and oauth_client_secret';
      END IF;
    ELSIF NEW.provider = 'custom' THEN
      IF coalesce(NEW.smtp_host,'') = '' THEN
        RAISE EXCEPTION 'Custom SMTP requires smtp_host';
      END IF;
      IF NEW.smtp_port IS NULL OR NEW.smtp_port < 1 OR NEW.smtp_port > 65535 THEN
        RAISE EXCEPTION 'Custom SMTP requires a valid smtp_port (1-65535)';
      END IF;
      IF coalesce(NEW.smtp_username,'') = '' OR coalesce(NEW.smtp_password,'') = '' THEN
        RAISE EXCEPTION 'Custom SMTP requires smtp_username and smtp_password';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_mail_server_settings ON public.mail_server_settings;
CREATE TRIGGER trg_validate_mail_server_settings
BEFORE INSERT OR UPDATE ON public.mail_server_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_mail_server_settings();

-- Ensure only ONE enabled row exists at any time
CREATE UNIQUE INDEX IF NOT EXISTS mail_server_settings_single_enabled
ON public.mail_server_settings ((1))
WHERE enabled = true;
