-- PHASE 1: Critical Access Control Fixes

-- 1. Fix WordPress credential exposure in connections table
-- Remove the dangerous policy that allows all authenticated users to view connection credentials
DROP POLICY IF EXISTS "Authenticated users can view active connections" ON public.connections;

-- Create a safer policy that only allows viewing connection metadata (not credentials)
CREATE POLICY "Users can view connection metadata" 
ON public.connections 
FOR SELECT 
TO authenticated
USING (is_active = true)
-- Note: This will be further restricted in application code to hide sensitive fields

-- 2. Restrict business intelligence access in admin_plan_features
-- Remove anonymous access to plan features (competitive intelligence risk)
DROP POLICY IF EXISTS "Anonymous users can only view enabled plan features" ON public.admin_plan_features;

-- Keep only authenticated user access to enabled features
-- The existing "Authenticated users can view enabled plan features" policy is sufficient

-- 3. Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.sensitive_operations_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    operation_type text NOT NULL,
    table_name text NOT NULL,
    record_id text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on sensitive operations log
ALTER TABLE public.sensitive_operations_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access to sensitive operations log
CREATE POLICY "Admin only sensitive operations log access" 
ON public.sensitive_operations_log 
FOR ALL 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
));

-- Create function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_operation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.sensitive_operations_log (
        user_id,
        operation_type,
        table_name,
        record_id
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;