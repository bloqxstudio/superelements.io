
-- Definir o usuário contatoigorpinheiro+1@gmail.com como admin
UPDATE public.profiles 
SET role = 'admin', updated_at = now() 
WHERE email = 'contatoigorpinheiro+1@gmail.com';

-- Verificar se o usuário foi atualizado corretamente
SELECT id, email, role, updated_at 
FROM public.profiles 
WHERE email = 'contatoigorpinheiro+1@gmail.com';
