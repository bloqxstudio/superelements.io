-- Remove the vulnerable public access policy for connections table
-- This policy was allowing anyone to view WordPress credentials
DROP POLICY IF EXISTS "Public can view active connections" ON public.connections;

-- The following policies remain intact and provide proper security:
-- 1. "Users can view their own connections" - authenticated users can see their own connections
-- 2. "Admins can manage all connections" - admins can manage all connections  
-- 3. "Users can create/update/delete their own connections" - proper user ownership

-- If public access to connection metadata is needed in the future,
-- consider creating a public view that excludes sensitive fields like:
-- username, application_password, and other credentials