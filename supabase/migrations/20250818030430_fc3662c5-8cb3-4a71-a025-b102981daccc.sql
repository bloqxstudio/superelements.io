-- SECURITY FIX 1: Remove public access to connections and strengthen RLS policies
DROP POLICY IF EXISTS "Public can view free connections" ON public.connections;

-- SECURITY FIX 2: Prevent users from escalating their own roles
CREATE POLICY "Prevent role self-escalation" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() = id AND 
  (OLD.role = NEW.role OR get_user_role(auth.uid()) = 'admin')
);

-- SECURITY FIX 3: Create audit logging table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admin only audit log access" 
ON public.security_audit_log 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

-- SECURITY FIX 4: Update database functions with secure search_path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id;
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

-- SECURITY FIX 5: Add trigger to log role changes
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF OLD.role != NEW.role THEN
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
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for role change logging
DROP TRIGGER IF EXISTS log_role_changes_trigger ON public.profiles;
CREATE TRIGGER log_role_changes_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_changes();

-- SECURITY FIX 6: Add function to log connection access
CREATE OR REPLACE FUNCTION public.log_connection_access(connection_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    event_type,
    event_data
  ) VALUES (
    auth.uid(),
    'connection_access',
    jsonb_build_object('connection_id', connection_id)
  );
END;
$function$;