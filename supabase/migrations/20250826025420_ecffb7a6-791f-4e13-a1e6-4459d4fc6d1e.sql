-- Add policy for unauthenticated users to view public shared connections
CREATE POLICY "Unauthenticated users can view public shared connections" 
ON public.connections 
FOR SELECT 
USING (
  auth.uid() IS NULL 
  AND user_type = 'all' 
  AND is_active = true
);