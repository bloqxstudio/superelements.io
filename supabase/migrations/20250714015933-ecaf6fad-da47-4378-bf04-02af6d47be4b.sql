-- Expandir tabela admin_payment_configs para suportar AbacatePay
ALTER TABLE public.admin_payment_configs 
ADD COLUMN payment_provider TEXT DEFAULT 'stripe',
ADD COLUMN abacatepay_product_id TEXT,
ADD COLUMN abacatepay_metadata JSONB;

-- Adicionar constraint para payment_provider
ALTER TABLE public.admin_payment_configs 
ADD CONSTRAINT admin_payment_configs_provider_check 
CHECK (payment_provider IN ('stripe', 'abacatepay'));

-- Criar tabela para transações AbacatePay
CREATE TABLE public.abacatepay_transactions (
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
CREATE POLICY "Users can view their own transactions" 
ON public.abacatepay_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Edge functions can insert transactions" 
ON public.abacatepay_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Edge functions can update transactions" 
ON public.abacatepay_transactions 
FOR UPDATE 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_abacatepay_transactions_updated_at
BEFORE UPDATE ON public.abacatepay_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações de pagamento AbacatePay para BRL
INSERT INTO public.admin_payment_configs (
  currency, 
  plan_type, 
  price_cents, 
  discount_percentage, 
  status, 
  payment_provider,
  abacatepay_product_id
) VALUES
-- Planos mensais AbacatePay
('BRL', 'monthly', 9700, 0, 'draft', 'abacatepay', 'abacate_pro_monthly'),
-- Planos anuais AbacatePay  
('BRL', 'annual', 56400, 42, 'draft', 'abacatepay', 'abacate_pro_annual'),
-- Plano Lifetime AbacatePay
('BRL', 'lifetime', 149700, 0, 'draft', 'abacatepay', 'abacate_lifetime')

ON CONFLICT (currency, plan_type, payment_provider) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  discount_percentage = EXCLUDED.discount_percentage,
  abacatepay_product_id = EXCLUDED.abacatepay_product_id,
  updated_at = now();

-- Atualizar constraint único para incluir payment_provider
ALTER TABLE public.admin_payment_configs 
DROP CONSTRAINT IF EXISTS admin_payment_configs_currency_plan_type_key;

ALTER TABLE public.admin_payment_configs 
ADD CONSTRAINT admin_payment_configs_currency_plan_type_provider_key 
UNIQUE (currency, plan_type, payment_provider);