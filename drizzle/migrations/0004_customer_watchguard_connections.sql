CREATE TABLE public.customer_watchguard_settings (
 customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
 region text NOT NULL DEFAULT 'deu',
 credentials_enc text NOT NULL,
 last_test_at timestamptz,
 last_test_ok boolean,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.customer_watchguard_settings TO service_role;
REVOKE ALL ON public.customer_watchguard_settings FROM anon, authenticated;
ALTER TABLE public.customer_watchguard_settings ENABLE ROW LEVEL SECURITY;