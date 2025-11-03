-- Allow everyone to view credentials for shared connections (user_type = 'all')
-- This enables free and logged-out users to access shared WordPress connections
CREATE POLICY "Anyone can view credentials for shared connections"
ON connection_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM connections 
    WHERE connections.id = connection_credentials.connection_id 
      AND connections.user_type = 'all'
      AND connections.is_active = true
  )
);