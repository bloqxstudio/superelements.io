-- Step 1: Create new table for sensitive credentials
CREATE TABLE public.connection_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  username text NOT NULL,
  application_password text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(connection_id)
);

-- Enable RLS
ALTER TABLE public.connection_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only connection owners can view their credentials
CREATE POLICY "Users can view their own connection credentials"
  ON public.connection_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = connection_credentials.connection_id
      AND connections.created_by = auth.uid()
    )
  );

-- RLS Policy: Only connection owners can insert credentials
CREATE POLICY "Users can create their own connection credentials"
  ON public.connection_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = connection_credentials.connection_id
      AND connections.created_by = auth.uid()
    )
  );

-- RLS Policy: Only connection owners can update credentials
CREATE POLICY "Users can update their own connection credentials"
  ON public.connection_credentials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = connection_credentials.connection_id
      AND connections.created_by = auth.uid()
    )
  );

-- RLS Policy: Only connection owners can delete credentials
CREATE POLICY "Users can delete their own connection credentials"
  ON public.connection_credentials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = connection_credentials.connection_id
      AND connections.created_by = auth.uid()
    )
  );

-- RLS Policy: Admins can manage all credentials
CREATE POLICY "Admins can manage all credentials"
  ON public.connection_credentials
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_connection_credentials_updated_at
  BEFORE UPDATE ON public.connection_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_connection_credentials_connection_id ON public.connection_credentials(connection_id);

-- Step 2: Migrate existing credentials to new table
INSERT INTO public.connection_credentials (connection_id, username, application_password, created_at, updated_at)
SELECT id, username, application_password, created_at, updated_at
FROM public.connections
WHERE username IS NOT NULL AND application_password IS NOT NULL;

-- Step 3: Remove credentials columns from connections table
ALTER TABLE public.connections DROP COLUMN IF EXISTS username;
ALTER TABLE public.connections DROP COLUMN IF EXISTS application_password;

-- Step 4: Update RLS policies on connections table
DROP POLICY IF EXISTS "All authenticated users can view shared connections" ON public.connections;
DROP POLICY IF EXISTS "Unauthenticated users can view public shared connections" ON public.connections;

-- Step 5: Create secure view for shared connections (metadata only - no credentials)
CREATE OR REPLACE VIEW public.shared_connections AS
SELECT 
  id,
  name,
  base_url,
  post_type,
  json_field,
  preview_field,
  status,
  is_active,
  user_type,
  components_count,
  created_at,
  updated_at
FROM public.connections
WHERE user_type = 'all' AND is_active = true;

-- Grant public read access to the view
GRANT SELECT ON public.shared_connections TO anon;
GRANT SELECT ON public.shared_connections TO authenticated;