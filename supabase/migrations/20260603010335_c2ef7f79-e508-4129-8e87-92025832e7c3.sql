-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from public/anon/authenticated.
-- These functions are invoked only by triggers and should never be called directly via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_mail_server_settings() FROM PUBLIC, anon, authenticated;