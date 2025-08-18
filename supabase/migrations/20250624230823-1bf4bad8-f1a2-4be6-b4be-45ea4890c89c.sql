
-- Add new columns to connections table
ALTER TABLE public.connections 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN user_type TEXT NOT NULL DEFAULT 'all' CHECK (user_type IN ('free', 'pro', 'all'));

-- Update existing connections to be active by default
UPDATE public.connections SET is_active = true WHERE is_active IS NULL;

-- Add index for better performance on filtering
CREATE INDEX idx_connections_active_user_type ON public.connections(is_active, user_type);
