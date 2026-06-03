-- Copilot usage table
CREATE TABLE public.customer_copilot_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  user_principal_name text NOT NULL,
  display_name text,
  assigned_sku text,
  has_assigned_license boolean DEFAULT false,
  last_activity_date date,
  copilot_chat_last_activity date,
  microsoft_teams_copilot_last_activity date,
  word_copilot_last_activity date,
  excel_copilot_last_activity date,
  powerpoint_copilot_last_activity date,
  outlook_copilot_last_activity date,
  onenote_copilot_last_activity date,
  loop_copilot_last_activity date,
  period_days integer DEFAULT 30,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, user_principal_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_copilot_usage TO authenticated;
GRANT ALL ON public.customer_copilot_usage TO service_role;

ALTER TABLE public.customer_copilot_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage copilot usage"
ON public.customer_copilot_usage FOR ALL TO authenticated
USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Scoped read copilot usage"
ON public.customer_copilot_usage FOR SELECT TO authenticated
USING ((customer_id = current_user_customer_id()) OR is_customer_admin_for(auth.uid(), customer_id));

-- Add copilot_synced column to sync logs
ALTER TABLE public.customer_azure_ad_sync_logs
ADD COLUMN IF NOT EXISTS copilot_synced integer DEFAULT 0;
