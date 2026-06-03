
CREATE TABLE public.customer_azure_ad_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  users_synced integer DEFAULT 0,
  devices_synced integer DEFAULT 0,
  duration_ms integer,
  error_message text,
  triggered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_azure_sync_logs_customer ON public.customer_azure_ad_sync_logs(customer_id, created_at DESC);

ALTER TABLE public.customer_azure_ad_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage azure sync logs"
  ON public.customer_azure_ad_sync_logs FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Customer users view own azure sync logs"
  ON public.customer_azure_ad_sync_logs FOR SELECT TO authenticated
  USING (customer_id = current_user_customer_id());
