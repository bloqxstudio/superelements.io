-- Create table for caching Figma conversions
CREATE TABLE figma_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id INTEGER NOT NULL,
  component_url TEXT NOT NULL,
  html_hash TEXT NOT NULL,
  figma_data JSONB NOT NULL,
  conversion_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  use_count INTEGER DEFAULT 1
);

-- Create unique index on component_id and html_hash
CREATE UNIQUE INDEX idx_figma_conversions_component_hash 
ON figma_conversions(component_id, html_hash);

-- Create index for fast lookups
CREATE INDEX idx_figma_conversions_component_id 
ON figma_conversions(component_id);

-- Create index for cleanup queries
CREATE INDEX idx_figma_conversions_last_used 
ON figma_conversions(last_used_at DESC);

-- Enable RLS
ALTER TABLE figma_conversions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read cache
CREATE POLICY "Authenticated users can read figma conversions"
ON figma_conversions FOR SELECT
TO authenticated
USING (true);

-- Policy: Only service role can write cache
CREATE POLICY "Service role can manage figma conversions"
ON figma_conversions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create view for statistics
CREATE VIEW figma_conversion_stats AS
SELECT 
  COUNT(*) as total_conversions,
  SUM(use_count) as total_uses,
  SUM(use_count - 1) as cache_hits,
  ROUND((SUM(use_count - 1)::NUMERIC / NULLIF(SUM(use_count), 0)) * 100, 2) as cache_hit_rate
FROM figma_conversions;