-- Adicionar colunas se não existem
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_payment_configs' 
        AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE public.admin_payment_configs 
        ADD COLUMN payment_provider TEXT DEFAULT 'stripe';
        
        -- Atualizar todos os registros existentes
        UPDATE public.admin_payment_configs 
        SET payment_provider = 'stripe' 
        WHERE payment_provider IS NULL;
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
END $$;

-- Políticas RLS para abacatepay_transactions (assumindo que a tabela já existe)
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