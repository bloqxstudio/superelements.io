-- Allow anyone (including unauthenticated users) to view public active connections
CREATE POLICY "Anyone can view public active connections"
ON public.connections
FOR SELECT
USING (user_type = 'all' AND is_active = true);