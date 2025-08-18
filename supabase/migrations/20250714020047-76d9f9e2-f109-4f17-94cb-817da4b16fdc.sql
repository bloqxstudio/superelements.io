-- Expandir tabela admin_payment_configs para suportar AbacatePay
ALTER TABLE public.admin_payment_configs 
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS abacatepay_product_id TEXT,
ADD COLUMN IF NOT EXISTS abacatepay_metadata JSONB;

-- Adicionar constraint para payment_provider
DO $$ 
BEGIN
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
  payment_method TEXT NOT NULL, -- 'pix' ou 'credit_card'
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
  plan_type TEXT NOT NULL, -- 'monthly', 'annual', 'lifetime'
  abacatepay_data JSONB, -- dados completos da transação do AbacatePay
  pix_code TEXT, -- código PIX para pagamentos PIX
  qr_code_url TEXT, -- URL do QR code para pagamentos PIX
  checkout_url TEXT, -- URL de checkout para cartão de crédito
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abacatepay_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para abacatepay_transactions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'abacatepay_transactions' 
        AND policyname = 'Users can view their own transactions'
    ) THEN
        CREATE POLICY "Users can view their own transactions" 
        ON public.abacatepay_transactions 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'abacatepay_transactions' 
        AND policyname = 'Edge functions can insert transactions'
    ) THEN
        CREATE POLICY "Edge functions can insert transactions" 
        ON public.abacatepay_transactions 
        FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'abacatepay_transactions' 
        AND policyname = 'Edge functions can update transactions'
    ) THEN
        CREATE POLICY "Edge functions can update transactions" 
        ON public.abacatepay_transactions 
        FOR UPDATE 
        USING (true);
    END IF;
END $$;

-- Trigger para updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_abacatepay_transactions_updated_at'
    ) THEN
        CREATE TRIGGER update_abacatepay_transactions_updated_at
        BEFORE UPDATE ON public.abacatepay_transactions
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Atualizar constraint único para incluir payment_provider
ALTER TABLE public.admin_payment_configs 
DROP CONSTRAINT IF EXISTS admin_payment_configs_currency_plan_type_key;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_payment_configs_currency_plan_type_provider_key'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD CONSTRAINT admin_payment_configs_currency_plan_type_provider_key 
        UNIQUE (currency, plan_type, payment_provider);
    END IF;
END $$;

-- Inserir configurações de pagamento AbacatePay para BRL
INSERT INTO public.admin_payment_configs (
  currency, 
  plan_type, 
  price_cents, 
  discount_percentage, 
  status, 
  payment_provider,
  abacatepay_product_id
) 
SELECT 'BRL', 'monthly', 9700, 0, 'draft', 'abacatepay', 'abacate_pro_monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'monthly' AND payment_provider = 'abacatepay'
);

INSERT INTO public.admin_payment_configs (
  currency, 
  plan_type, 
  price_cents, 
  discount_percentage, 
  status, 
  payment_provider,
  abacatepay_product_id
) 
SELECT 'BRL', 'annual', 56400, 42, 'draft', 'abacatepay', 'abacate_pro_annual'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'annual' AND payment_provider = 'abacatepay'
);

INSERT INTO public.admin_payment_configs (
  currency, 
  plan_type, 
  price_cents, 
  discount_percentage, 
  status, 
  payment_provider,
  abacatepay_product_id
) 
SELECT 'BRL', 'lifetime', 149700, 0, 'draft', 'abacatepay', 'abacate_lifetime'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_payment_configs 
    WHERE currency = 'BRL' AND plan_type = 'lifetime' AND payment_provider = 'abacatepay'
);