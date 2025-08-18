-- Insert missing AbacatePay payment configurations using conditional logic
DO $$
BEGIN
  -- Insert monthly configuration if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE plan_type = 'monthly' AND currency = 'BRL' AND payment_provider = 'abacatepay'
  ) THEN
    INSERT INTO public.admin_payment_configs (
      plan_type, currency, price_cents, payment_provider, abacatepay_product_id, status, created_at, updated_at
    ) VALUES (
      'monthly', 'BRL', 9700, 'abacatepay', 'pro_monthly_brl', 'live', now(), now()
    );
  ELSE
    UPDATE public.admin_payment_configs 
    SET price_cents = 9700, status = 'live', updated_at = now()
    WHERE plan_type = 'monthly' AND currency = 'BRL' AND payment_provider = 'abacatepay';
  END IF;

  -- Insert annual configuration if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE plan_type = 'annual' AND currency = 'BRL' AND payment_provider = 'abacatepay'
  ) THEN
    INSERT INTO public.admin_payment_configs (
      plan_type, currency, price_cents, payment_provider, abacatepay_product_id, status, created_at, updated_at
    ) VALUES (
      'annual', 'BRL', 29970, 'abacatepay', 'pro_annual_brl', 'live', now(), now()
    );
  ELSE
    UPDATE public.admin_payment_configs 
    SET status = 'live', updated_at = now()
    WHERE plan_type = 'annual' AND currency = 'BRL' AND payment_provider = 'abacatepay';
  END IF;
END $$;