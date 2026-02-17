-- Create table to store imported pages from client sites
CREATE TABLE IF NOT EXISTS client_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  wordpress_page_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  modified_date TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT now(),
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(connection_id, wordpress_page_id)
);

-- Add index for efficient queries
CREATE INDEX idx_client_pages_connection ON client_pages(connection_id);
CREATE INDEX idx_client_pages_status ON client_pages(status);

-- Add RLS policies
ALTER TABLE client_pages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all client pages
CREATE POLICY "Allow authenticated users to read client pages"
  ON client_pages
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert client pages
CREATE POLICY "Allow authenticated users to insert client pages"
  ON client_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update client pages
CREATE POLICY "Allow authenticated users to update client pages"
  ON client_pages
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete client pages
CREATE POLICY "Allow authenticated users to delete client pages"
  ON client_pages
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE client_pages IS 'Stores WordPress pages imported from client sites for tracking and management';
