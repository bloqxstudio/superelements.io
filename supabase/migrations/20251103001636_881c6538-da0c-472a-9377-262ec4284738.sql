-- Allow free users to view credentials for free-tier connections
-- This enables authenticated free users to access free WordPress connections
CREATE POLICY "Free users can view credentials for free connections"
ON connection_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM connections 
    WHERE connections.id = connection_credentials.connection_id 
      AND connections.user_type IN ('all', 'free')
      AND connections.is_active = true
  )
  AND auth.uid() IS NOT NULL
);