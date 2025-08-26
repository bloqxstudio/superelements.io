-- Fix existing connections with null created_by
-- Associate them with the admin user so they can be accessed
UPDATE public.connections 
SET created_by = '11880618-81dc-4b1a-a4c3-f1f57b642d3b'
WHERE created_by IS NULL;

-- Add a policy to allow all authenticated users to view connections 
-- marked as user_type 'all' for better access to shared connections
CREATE POLICY "All authenticated users can view shared connections" 
ON public.connections 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_type = 'all' 
  AND is_active = true
);