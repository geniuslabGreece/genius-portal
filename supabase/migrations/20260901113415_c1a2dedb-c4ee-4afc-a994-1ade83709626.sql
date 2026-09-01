REVOKE ALL ON FUNCTION public.handle_user_email_verified() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_email_verified() TO service_role;