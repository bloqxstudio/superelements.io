-- Adicionar colunas para suporte ao AbacatePay
DO $$ 
BEGIN
    -- Adicionar payment_provider se não existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN payment_provider TEXT DEFAULT 'stripe';
    END IF;

    -- Adicionar abacatepay_product_id se não existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'abacatepay_product_id'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN abacatepay_product_id TEXT;
    END IF;

    -- Adicionar abacatepay_metadata se não existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'abacatepay_metadata'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN abacatepay_metadata JSONB;
    END IF;

    -- Atualizar registros existentes
    UPDATE public.admin_payment_configs 
    SET payment_provider = 'stripe' 
    WHERE payment_provider IS NULL;

    -- Adicionar constraint se não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_payment_configs_provider_check'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD CONSTRAINT admin_payment_configs_provider_check 
        CHECK (payment_provider IN ('stripe', 'abacatepay'));
    END IF;
END $$;