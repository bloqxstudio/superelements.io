-- Remove 'custom components' feature from PRO plan
DELETE FROM public.admin_plan_features 
WHERE plan_name = 'pro' AND feature_name = 'Custom components';