ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS sharepoint_customer_id INTEGER;

COMMENT ON COLUMN public.customers.sharepoint_customer_id IS 'SharePoint List1 (Πελάτες) item id — used to fetch engineer worklogs from Καταχώρηση Εργασιών list. Optional; if null, auto-matched by ΑΦΜ.';