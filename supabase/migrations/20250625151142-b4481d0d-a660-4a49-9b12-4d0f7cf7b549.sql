
-- Verificar se existem políticas RLS na tabela connections que possam estar bloqueando usuários FREE
-- Criar política para permitir que todos os usuários autenticados vejam conexões ativas

-- Policy para SELECT: Usuários autenticados podem ver conexões ativas
CREATE POLICY "Authenticated users can view active connections" 
  ON public.connections 
  FOR SELECT 
  TO authenticated
  USING (is_active = true);

-- Policy adicional para usuários não autenticados verem conexões públicas (user_type = 'free' ou 'all')
CREATE POLICY "Public can view free connections" 
  ON public.connections 
  FOR SELECT 
  TO anon
  USING (is_active = true AND (user_type = 'free' OR user_type = 'all'));
