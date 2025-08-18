-- Primeiro, vamos ver a estrutura atual
DO $$ 
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- Verificar se as colunas já existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN payment_provider TEXT DEFAULT 'stripe';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'abacatepay_product_id'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN abacatepay_product_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'abacatepay_metadata'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN abacatepay_metadata JSONB;
    END IF;

    -- Atualizar registros existentes para incluir payment_provider
    UPDATE public.admin_payment_configs 
    SET payment_provider = 'stripe' 
    WHERE payment_provider IS NULL;

    -- Remover constraint antigo se existir
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_payment_configs_currency_plan_type_status_key'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        ALTER TABLE public.admin_payment_configs 
        DROP CONSTRAINT admin_payment_configs_currency_plan_type_status_key;
    END IF;

    -- Adicionar novo constraint único que inclui payment_provider
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_payment_configs_currency_plan_type_provider_key'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD CONSTRAINT admin_payment_configs_currency_plan_type_provider_key 
        UNIQUE (currency, plan_type, payment_provider);
    END IF;

    -- Adicionar constraint de check para payment_provider
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_payment_configs_provider_check'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD CONSTRAINT admin_payment_configs_provider_check 
        CHECK (payment_provider IN ('stripe', 'abacatepay'));
    END IF;
END $$;

-- Criar tabela para transações AbacatePay
CREATE TABLE IF NOT EXISTS public.abacatepay_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  payment_method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  plan_type TEXT NOT NULL,
  abacatepay_data JSONB,
  pix_code TEXT,
  qr_code_url TEXT,
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS na nova tabela
ALTER TABLE public.abacatepay_transactions ENABLE ROW LEVEL SECURITY;

-- Inserir configurações AbacatePay apenas se não existirem
INSERT INTO public.admin_payment_configs (
  currency, plan_type, price_cents, discount_percentage, 
  status, payment_provider, abacatepay_product_id
) 
SELECT 'BRL', 'monthly', 9700, 0, 'draft', 'abacatepay', 'abacate_pro_monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'monthly' AND payment_provider = 'abacatepay'
);

INSERT INTO public.admin_payment_configs (
  currency, plan_type, price_cents, discount_percentage, 
  status, payment_provider, abacatepay_product_id
) 
SELECT 'BRL', 'annual', 56400, 42, 'draft', 'abacatepay', 'abacate_pro_annual'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'annual' AND payment_provider = 'abacatepay'
);

INSERT INTO public.admin_payment_configs (
  currency, plan_type, price_cents, discount_percentage, 
  status, payment_provider, abacatepay_product_id
) 
SELECT 'BRL', 'lifetime', 149700, 0, 'draft', 'abacatepay', 'abacate_lifetime'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'lifetime' AND payment_provider = 'abacatepay'
);