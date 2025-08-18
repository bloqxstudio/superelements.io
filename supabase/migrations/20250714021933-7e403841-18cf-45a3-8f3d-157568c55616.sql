-- Update AbacatePay payment configurations with correct prices
UPDATE public.admin_payment_configs 
SET 
  price_cents = 9700,
  status = 'live',
  updated_at = now()
WHERE plan_type = 'monthly' AND currency = 'BRL' AND payment_provider = 'abacatepay';

UPDATE public.admin_payment_configs 
SET 
  price_cents = 149700,
  status = 'live', 
  updated_at = now()
WHERE plan_type = 'lifetime' AND currency = 'BRL' AND payment_provider = 'abacatepay';

-- Keep annual price as is (29970 = R$ 299,70) but mark as live
UPDATE public.admin_payment_configs 
SET 
  status = 'live',
  updated_at = now()
WHERE plan_type = 'annual' AND currency = 'BRL' AND payment_provider = 'abacatepay';