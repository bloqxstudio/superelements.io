-- Clear existing features
DELETE FROM public.admin_plan_features;

-- Insert FREE plan features
INSERT INTO public.admin_plan_features (plan_name, feature_name, feature_description, display_order, is_enabled) VALUES
('starter', 'Basic components', 'Access to essential UI components and templates', 1, true),
('starter', 'Community support', 'Access to community forums and basic support', 2, true);

-- Insert PRO plan features  
INSERT INTO public.admin_plan_features (plan_name, feature_name, feature_description, display_order, is_enabled) VALUES
('pro', 'All components', 'Access to the complete component library', 1, true),
('pro', 'Custom components', 'Create and customize your own components', 2, true),
('pro', 'Priority support', '24/7 priority customer support with faster response times', 3, true),
('pro', 'Weekly drop', 'Get new components and templates every week', 4, true);