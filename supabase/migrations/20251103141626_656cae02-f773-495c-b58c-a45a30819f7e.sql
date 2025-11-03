-- Ajustar políticas de acesso para permitir visualização mas controlar cópia

-- 1. CONNECTIONS TABLE: Permitir todos usuários autenticados verem conexões ativas
-- Remover policy antiga restritiva
DROP POLICY IF EXISTS "Anyone can view public active connections" ON public.connections;

-- Criar nova policy permissiva para visualização de todas conexões ativas
CREATE POLICY "Anyone can view active connections"
ON public.connections
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. CONNECTION_CREDENTIALS TABLE: Permitir usuários autenticados verem credenciais de conexões ativas
-- (necessário para preview/iframe funcionar)
DROP POLICY IF EXISTS "Anyone can view credentials for shared connections" ON public.connection_credentials;
DROP POLICY IF EXISTS "Free users can view credentials for free connections" ON public.connection_credentials;

-- Nova policy para credenciais - usuários autenticados podem ver credenciais de conexões ativas
CREATE POLICY "Authenticated users can view active connection credentials"
ON public.connection_credentials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM connections
    WHERE connections.id = connection_credentials.connection_id
    AND connections.is_active = true
  )
);