-- Store latest PageSpeed data by client page and strategy
CREATE TABLE IF NOT EXISTS client_page_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_page_id UUID REFERENCES client_pages(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  performance_score INTEGER,
  lcp_ms INTEGER,
  inp_ms INTEGER,
  tbt_ms INTEGER,
  cls NUMERIC(8, 3),
  report_url TEXT,
  raw_result JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_page_id, strategy)
);

CREATE INDEX IF NOT EXISTS idx_client_page_performance_client_page_id
  ON client_page_performance (client_page_id);

CREATE INDEX IF NOT EXISTS idx_client_page_performance_connection_id
  ON client_page_performance (connection_id);

CREATE INDEX IF NOT EXISTS idx_client_page_performance_fetched_at
  ON client_page_performance (fetched_at DESC);

ALTER TABLE client_page_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read client page performance"
  ON client_page_performance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert client page performance"
  ON client_page_performance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update client page performance"
  ON client_page_performance
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete client page performance"
  ON client_page_performance
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE client_page_performance IS 'Stores PageSpeed metrics for client pages (mobile/desktop)';
