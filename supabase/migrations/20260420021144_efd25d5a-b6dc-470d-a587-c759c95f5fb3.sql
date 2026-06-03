-- SoftOne settings (singleton row, only admins access)
CREATE TABLE public.softone_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  service_url TEXT,
  username TEXT,
  password TEXT,
  app_id TEXT DEFAULT '703',
  company TEXT DEFAULT '1000',
  branch TEXT DEFAULT '1000',
  module TEXT DEFAULT '0',
  refid TEXT DEFAULT '1',
  customers_sql TEXT DEFAULT 'SELECT TRDR as id, CODE as code, NAME as name, AFM as vat, EMAIL as email, PHONE01 as phone, ADDRESS as address FROM CUSTOMER WHERE ISACTIVE=1',
  contracts_sql TEXT DEFAULT 'SELECT MTRL as product_code, ITEM as product_name, QTY1 as quantity, FROMDATE as start_date, TODATE as end_date, REMARKS as notes FROM SOSOURCE',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.softone_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage softone settings"
ON public.softone_settings FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_softone_settings_updated_at
BEFORE UPDATE ON public.softone_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync logs
CREATE TABLE public.softone_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  customers_synced INTEGER DEFAULT 0,
  contracts_synced INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  message TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.softone_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
ON public.softone_sync_logs FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert sync logs"
ON public.softone_sync_logs FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Insert default singleton row
INSERT INTO public.softone_settings (enabled) VALUES (false);

-- Add softone_id column to customers for matching
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS softone_id TEXT UNIQUE;

-- Add softone_id column to products for matching
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS softone_code TEXT;