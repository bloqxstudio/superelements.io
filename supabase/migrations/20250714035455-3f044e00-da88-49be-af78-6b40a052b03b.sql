-- Corrrigir o preço do plano anual para R$564 (56400 centavos)
UPDATE admin_payment_configs 
SET price_cents = 56400,
    updated_at = now()
WHERE plan_type = 'annual' 
AND payment_provider = 'abacatepay' 
AND currency = 'BRL';