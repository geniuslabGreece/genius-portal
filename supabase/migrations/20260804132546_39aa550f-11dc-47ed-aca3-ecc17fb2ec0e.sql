-- Trigger-only functions: never callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_primary_portal_admin_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tickets_prevent_customer_field_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_mail_server_settings() FROM PUBLIC, anon, authenticated;

-- Authorization helpers: used by RLS policies for signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_customer_admin_for(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_customer_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_customer_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_customer_admin_for(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_customer_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_customer_id() TO authenticated, service_role;