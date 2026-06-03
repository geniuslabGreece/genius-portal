ALTER TABLE public.softone_settings
ADD COLUMN IF NOT EXISTS deployment_type text NOT NULL DEFAULT 'on_premise',
ADD COLUMN IF NOT EXISTS products_sql text DEFAULT 'SELECT MTRL as id, CODE as code, NAME as name, MANFCTR as vendor FROM MTRL WHERE ISACTIVE=1';

ALTER TABLE public.softone_sync_logs
ADD COLUMN IF NOT EXISTS products_synced integer DEFAULT 0;