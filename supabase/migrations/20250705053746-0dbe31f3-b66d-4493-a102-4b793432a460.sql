-- Create admin_plan_features table
CREATE TABLE public.admin_plan_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name VARCHAR NOT NULL CHECK (plan_name IN ('starter', 'pro')),
  feature_name VARCHAR NOT NULL,
  feature_description TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(plan_name, feature_name)
);

-- Enable RLS
ALTER TABLE public.admin_plan_features ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admin access
CREATE POLICY "Admin only access to plan features" 
ON public.admin_plan_features 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'::app_role
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_plan_features_updated_at
  BEFORE UPDATE ON public.admin_plan_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default features for STARTER plan
INSERT INTO public.admin_plan_features (plan_name, feature_name, feature_description, display_order, is_enabled) VALUES
('starter', 'Basic components', 'Access to essential UI components', 1, true),
('starter', 'Standard templates', 'Pre-built template collection', 2, true),
('starter', 'Community support', 'Access to community forums and resources', 3, true),
('starter', '5 projects', 'Create up to 5 projects', 4, true);

-- Insert default features for PRO plan
INSERT INTO public.admin_plan_features (plan_name, feature_name, feature_description, display_order, is_enabled) VALUES
('pro', 'All components', 'Access to complete component library', 1, true),
('pro', 'Premium templates', 'Exclusive premium template collection', 2, true),
('pro', 'Priority support', '24/7 priority customer support', 3, true),
('pro', 'Advanced features', 'Advanced tools and functionality', 4, true),
('pro', 'Unlimited projects', 'Create unlimited projects', 5, true);