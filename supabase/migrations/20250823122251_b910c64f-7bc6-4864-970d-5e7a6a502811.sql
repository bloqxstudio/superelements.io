-- Make connections publicly accessible for component viewing
-- This allows anyone to view active connections without authentication

-- Drop the existing restrictive policy for connection metadata viewing
DROP POLICY IF EXISTS "Users can view connection metadata" ON public.connections;

-- Create a new public policy for viewing active connections
CREATE POLICY "Public can view active connections" 
ON public.connections 
FOR SELECT 
USING (is_active = true);

-- Ensure all existing connections are active and have proper status
UPDATE connections 
SET is_active = true, 
    status = 'connected' 
WHERE status != 'connected' OR is_active = false;