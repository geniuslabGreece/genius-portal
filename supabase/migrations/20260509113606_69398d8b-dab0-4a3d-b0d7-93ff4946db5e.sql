
ALTER TABLE public.customer_azure_ad_settings
  ADD COLUMN IF NOT EXISTS client_secret_enc bytea;

-- Drop the plaintext column so secrets are never readable again
ALTER TABLE public.customer_azure_ad_settings
  DROP COLUMN IF EXISTS client_secret;
