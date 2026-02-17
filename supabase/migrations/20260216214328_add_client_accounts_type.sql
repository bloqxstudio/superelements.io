-- Add connection_type field to distinguish between designer connections and client accounts
ALTER TABLE connections
ADD COLUMN connection_type TEXT DEFAULT 'designer_connection'
CHECK (connection_type IN ('designer_connection', 'client_account'));

-- Add index for efficient filtering
CREATE INDEX idx_connections_type ON connections(connection_type) WHERE is_active = true;

-- Add comment explaining the field
COMMENT ON COLUMN connections.connection_type IS 'Discriminator: designer_connection for Elementor component imports, client_account for client WordPress sites';
