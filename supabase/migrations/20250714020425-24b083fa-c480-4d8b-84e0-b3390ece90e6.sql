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

-- Políticas RLS
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