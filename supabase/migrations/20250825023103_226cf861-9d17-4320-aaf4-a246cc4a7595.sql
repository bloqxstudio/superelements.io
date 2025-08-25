-- Remove unused tables
DROP TABLE IF EXISTS public.videos CASCADE;
DROP TABLE IF EXISTS public.admin_analytics_events CASCADE;
DROP TABLE IF EXISTS public.admin_campaigns CASCADE;
DROP TABLE IF EXISTS public.admin_payment_configs CASCADE;
DROP TABLE IF EXISTS public.admin_plan_features CASCADE;
DROP TABLE IF EXISTS public.admin_stripe_configs CASCADE;
DROP TABLE IF EXISTS public.security_audit_log CASCADE;
DROP TABLE IF EXISTS public.sensitive_operations_log CASCADE;
DROP TABLE IF EXISTS public.abacatepay_transactions CASCADE;
DROP TABLE IF EXISTS public.subscribers CASCADE;

-- Remove unused database functions
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.email_exists(text);
DROP FUNCTION IF EXISTS public.log_role_changes();

-- Clean up any remaining references
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS role_changes_trigger ON public.profiles;