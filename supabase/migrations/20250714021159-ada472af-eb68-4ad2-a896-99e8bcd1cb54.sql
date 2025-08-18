-- Insert AbacatePay payment configurations
INSERT INTO public.admin_payment_configs (
  plan_type,
  currency,
  price_cents,
  payment_provider,
  abacatepay_product_id,
  status,
  created_at,
  updated_at
) VALUES 
  ('monthly', 'BRL', 2997, 'abacatepay', 'pro_monthly_brl', 'live', now(), now()),
  ('annual', 'BRL', 29970, 'abacatepay', 'pro_annual_brl', 'live', now(), now()),
  ('lifetime', 'BRL', 89970, 'abacatepay', 'pro_lifetime_brl', 'live', now(), now())
ON CONFLICT DO NOTHING;