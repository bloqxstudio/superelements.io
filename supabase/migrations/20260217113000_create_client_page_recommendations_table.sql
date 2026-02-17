-- AI recommendations generated from PageSpeed/Lighthouse reports
CREATE TABLE IF NOT EXISTS client_page_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_page_id UUID NOT NULL REFERENCES client_pages(id) ON DELETE CASCADE,
  performance_id UUID REFERENCES client_page_performance(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  summary TEXT NOT NULL DEFAULT '',
  priority_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  quick_wins JSONB NOT NULL DEFAULT '[]'::jsonb,
  wordpress_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_page_id, strategy)
);

CREATE INDEX IF NOT EXISTS idx_client_page_recommendations_client_page
  ON client_page_recommendations (client_page_id);

CREATE INDEX IF NOT EXISTS idx_client_page_recommendations_connection
  ON client_page_recommendations (connection_id);

CREATE INDEX IF NOT EXISTS idx_client_page_recommendations_generated_at
  ON client_page_recommendations (generated_at DESC);

ALTER TABLE client_page_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read client page recommendations"
  ON client_page_recommendations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert client page recommendations"
  ON client_page_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update client page recommendations"
  ON client_page_recommendations
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete client page recommendations"
  ON client_page_recommendations
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE client_page_recommendations IS 'AI-generated improvement plans from Lighthouse/PageSpeed reports';
