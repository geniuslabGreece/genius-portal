-- Enums
CREATE TYPE public.ticket_department AS ENUM ('technical', 'software', 'erp', 'hardware', 'devices');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.ticket_message_author AS ENUM ('customer', 'admin', 'ai_bot', 'system');

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  created_by UUID NOT NULL,
  department public.ticket_department NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  assigned_to UUID,
  ai_chat_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_customer ON public.tickets(customer_id);
CREATE INDEX idx_tickets_department ON public.tickets(department);
CREATE INDEX idx_tickets_status ON public.tickets(status);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tickets" ON public.tickets
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Customers view their tickets" ON public.tickets
  FOR SELECT USING (customer_id = public.current_user_customer_id());

CREATE POLICY "Customers create tickets for their company" ON public.tickets
  FOR INSERT WITH CHECK (
    customer_id = public.current_user_customer_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Customers update their own tickets (limited)" ON public.tickets
  FOR UPDATE USING (
    customer_id = public.current_user_customer_id()
    AND created_by = auth.uid()
  );

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket messages
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_user_id UUID,
  author_type public.ticket_message_author NOT NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all messages" ON public.ticket_messages
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Customers view non-internal messages on their tickets" ON public.ticket_messages
  FOR SELECT USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.customer_id = public.current_user_customer_id()
    )
  );

CREATE POLICY "Customers add messages to their tickets" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    is_internal = false
    AND author_type = 'customer'
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.customer_id = public.current_user_customer_id()
    )
  );

-- Department routing settings
CREATE TABLE public.ticket_department_settings (
  department public.ticket_department PRIMARY KEY,
  notify_email TEXT,
  display_name TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_department_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view departments" ON public.ticket_department_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage department settings" ON public.ticket_department_settings
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.ticket_department_settings (department, display_name, description) VALUES
  ('technical', 'Τεχνικό Τμήμα', 'Δικτύωση, υποδομές, ασφάλεια, υποστήριξη υλικού επί τόπου'),
  ('software', 'Software', 'Άδειες, εφαρμογές, cloud subscriptions'),
  ('erp', 'ERP / SoftOne', 'SoftOne, παραγωγή, CRM, e-Invoicing'),
  ('hardware', 'Hardware', 'Servers, firewalls, εξοπλισμός'),
  ('devices', 'Συσκευές', 'Laptops, εκτυπωτές, φορητές συσκευές');
