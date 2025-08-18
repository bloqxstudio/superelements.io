-- Update existing payment configurations to use AbacatePay
UPDATE public.admin_payment_configs 
SET 
  payment_provider = 'abacatepay',
  abacatepay_product_id = 'pro_monthly_brl',
  price_cents = 9700,
  status = 'live',
  updated_at = now()
WHERE plan_type = 'monthly' AND currency = 'BRL';

UPDATE public.admin_payment_configs 
SET 
  payment_provider = 'abacatepay',
  abacatepay_product_id = 'pro_annual_brl',
  price_cents = 29970,
  status = 'live',
  updated_at = now()
WHERE plan_type = 'annual' AND currency = 'BRL';

UPDATE public.admin_payment_configs 
SET 
  payment_provider = 'abacatepay',
  abacatepay_product_id = 'pro_lifetime_brl',
  price_cents = 149700,
  status = 'live',
  updated_at = now()
WHERE plan_type = 'lifetime' AND currency = 'BRL';