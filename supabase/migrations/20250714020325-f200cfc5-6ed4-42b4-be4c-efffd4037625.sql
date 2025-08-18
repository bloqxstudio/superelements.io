-- Apenas adicionar colunas para suporte ao AbacatePay
ALTER TABLE public.admin_payment_configs 
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS abacatepay_product_id TEXT,
ADD COLUMN IF NOT EXISTS abacatepay_metadata JSONB;

-- Atualizar registros existentes para ter payment_provider definido
UPDATE public.admin_payment_configs 
SET payment_provider = 'stripe' 
WHERE payment_provider IS NULL;

-- Adicionar constraint para payment_provider
ALTER TABLE public.admin_payment_configs 
ADD CONSTRAINT IF NOT EXISTS admin_payment_configs_provider_check 
CHECK (payment_provider IN ('stripe', 'abacatepay'));