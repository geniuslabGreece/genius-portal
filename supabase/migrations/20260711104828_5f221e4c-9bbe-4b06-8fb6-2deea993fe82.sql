
CREATE TABLE public.ai_assistant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  system_prompt TEXT,
  custom_api_key TEXT,
  custom_base_url TEXT,
  temperature NUMERIC,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_assistant_settings_singleton_uniq UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assistant_settings TO authenticated;
GRANT ALL ON public.ai_assistant_settings TO service_role;

ALTER TABLE public.ai_assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai settings"
  ON public.ai_assistant_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert ai settings"
  ON public.ai_assistant_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update ai settings"
  ON public.ai_assistant_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete ai settings"
  ON public.ai_assistant_settings FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER ai_assistant_settings_updated_at
  BEFORE UPDATE ON public.ai_assistant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_assistant_settings (singleton, model)
VALUES (true, 'google/gemini-3-flash-preview')
ON CONFLICT (singleton) DO NOTHING;
