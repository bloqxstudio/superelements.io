-- Fix critical security vulnerability in subscribers table RLS policies

-- Drop the current insecure policies
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create secure update policy - users can only update their own subscriptions
CREATE POLICY "update_own_subscription" 
ON public.subscribers 
FOR UPDATE 
USING ((user_id = auth.uid()) OR (email = auth.email()));

-- Create secure insert policy - users can only create subscriptions for themselves
CREATE POLICY "insert_own_subscription" 
ON public.subscribers 
FOR INSERT 
WITH CHECK ((user_id = auth.uid()) OR (email = auth.email()));

-- Create service role insert policy for edge functions (webhooks, etc.)
CREATE POLICY "service_role_insert_subscription" 
ON public.subscribers 
FOR INSERT 
TO service_role 
WITH CHECK (true);