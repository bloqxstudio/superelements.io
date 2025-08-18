
-- Create connections table to store WordPress connections
CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'posts',
  json_field TEXT NOT NULL DEFAULT '_elementor_data',
  preview_field TEXT NOT NULL DEFAULT 'link',
  username TEXT NOT NULL,
  application_password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  last_tested TIMESTAMP WITH TIME ZONE,
  components_count INTEGER DEFAULT 0,
  error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Create policies for connections table
-- Admins can do everything
CREATE POLICY "Admins can manage all connections" 
  ON public.connections 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Pro users can only view connections
CREATE POLICY "Pro users can view connections" 
  ON public.connections 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'pro_user'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_connections_updated_at 
  BEFORE UPDATE ON public.connections 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
