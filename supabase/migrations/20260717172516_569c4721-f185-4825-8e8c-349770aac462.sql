DROP POLICY IF EXISTS "Customers update their own tickets (limited)" ON public.tickets;
CREATE POLICY "Customers update their own tickets (limited)" ON public.tickets
  FOR UPDATE
  USING (customer_id = public.current_user_customer_id() AND created_by = auth.uid())
  WITH CHECK (customer_id = public.current_user_customer_id() AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.tickets_prevent_customer_field_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.customer_id := OLD.customer_id;
  NEW.created_by := OLD.created_by;
  NEW.assigned_to := OLD.assigned_to;
  NEW.priority := OLD.priority;
  NEW.status := OLD.status;
  NEW.department := OLD.department;
  NEW.ticket_number := OLD.ticket_number;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tickets_prevent_customer_field_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tickets_prevent_escalation ON public.tickets;
CREATE TRIGGER trg_tickets_prevent_escalation
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_prevent_customer_field_escalation();