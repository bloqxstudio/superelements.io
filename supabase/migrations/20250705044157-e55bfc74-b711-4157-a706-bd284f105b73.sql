-- First, create a unique constraint on currency and plan_type
ALTER TABLE public.admin_payment_configs 
ADD CONSTRAINT admin_payment_configs_currency_plan_type_key 
UNIQUE (currency, plan_type);

-- Then insert sample pricing configurations for USD and BRL
INSERT INTO public.admin_payment_configs (currency, plan_type, price_cents, discount_percentage, status) VALUES
-- USD pricing
('USD', 'monthly', 2900, 0, 'draft'),
('USD', 'quarterly', 5700, 34, 'draft'),
('USD', 'annual', 14400, 58, 'draft'),
('USD', 'founder', 870, 70, 'draft'),

-- BRL pricing  
('BRL', 'monthly', 11400, 0, 'draft'),
('BRL', 'quarterly', 22400, 34, 'draft'),
('BRL', 'annual', 56400, 58, 'draft'),
('BRL', 'founder', 4700, 70, 'draft')

ON CONFLICT (currency, plan_type) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  discount_percentage = EXCLUDED.discount_percentage,
  updated_at = now();