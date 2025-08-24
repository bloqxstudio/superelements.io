-- Create a specific RLS policy to allow email verification for unauthenticated users
-- This allows the authentication flow to check if an email already exists
CREATE POLICY "Allow email verification for auth flow" 
ON public.profiles 
FOR SELECT 
TO anon
USING (true);