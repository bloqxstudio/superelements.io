-- Phase 1: Database Security Configuration Fixes

-- Update database functions with secure search_path settings
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.log_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Log all role changes
  INSERT INTO public.security_audit_log (
    user_id,
    event_type,
    event_data
  ) VALUES (
    NEW.id,
    'role_change',
    jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role,
      'changed_by', auth.uid()
    )
  );
  
  -- Prevent users from changing their own role (except admins)
  IF OLD.role != NEW.role AND auth.uid() = NEW.id THEN
    -- Check if the user trying to change the role is an admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'free'
  );
  RETURN NEW;
END;
$function$;

-- Restrict admin_plan_features public access to only enabled features for anonymous users
DROP POLICY IF EXISTS "Public can view enabled plan features" ON public.admin_plan_features;

CREATE POLICY "Anonymous users can only view enabled plan features" 
ON public.admin_plan_features 
FOR SELECT 
TO anon
USING (is_enabled = true);

CREATE POLICY "Authenticated users can view enabled plan features" 
ON public.admin_plan_features 
FOR SELECT 
TO authenticated
USING (is_enabled = true);

-- Add trigger for role changes if not exists
DROP TRIGGER IF EXISTS log_role_changes_trigger ON public.profiles;
CREATE TRIGGER log_role_changes_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_changes();