-- Create RLS policy for public read access to enabled plan features
CREATE POLICY "Public can view enabled plan features" 
ON public.admin_plan_features 
FOR SELECT 
TO PUBLIC
USING (is_enabled = true);