
CREATE TABLE public.ticket_worklogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharepoint_item_id TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  sharepoint_customer_id INTEGER,
  engineer TEXT,
  engineer_email TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  hours NUMERIC,
  duration TEXT,
  method TEXT,
  description TEXT,
  tech_notes TEXT,
  signature TEXT,
  title TEXT,
  web_url TEXT,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_worklogs_ticket ON public.ticket_worklogs(ticket_id);
CREATE INDEX idx_ticket_worklogs_customer ON public.ticket_worklogs(customer_id);

GRANT SELECT ON public.ticket_worklogs TO authenticated;
GRANT ALL ON public.ticket_worklogs TO service_role;
ALTER TABLE public.ticket_worklogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view worklogs of accessible customers"
ON public.ticket_worklogs FOR SELECT
TO authenticated
USING (customer_id IS NULL OR public.user_has_customer_access(auth.uid(), customer_id));
