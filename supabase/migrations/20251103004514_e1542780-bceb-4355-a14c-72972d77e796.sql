-- Adicionar coluna slug na tabela connections
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS slug text;

-- Criar índice único para slugs
CREATE UNIQUE INDEX IF NOT EXISTS connections_slug_idx 
ON public.connections(slug);

-- Função para gerar slug automaticamente
CREATE OR REPLACE FUNCTION generate_connection_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Gerar slug base a partir do nome
  base_slug := lower(regexp_replace(
    regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  
  -- Remover hífens extras
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Garantir unicidade
  WHILE EXISTS (
    SELECT 1 FROM public.connections 
    WHERE slug = final_slug AND id != NEW.id
  ) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para auto-gerar slug
DROP TRIGGER IF EXISTS set_connection_slug ON public.connections;
CREATE TRIGGER set_connection_slug
BEFORE INSERT OR UPDATE ON public.connections
FOR EACH ROW
WHEN (NEW.slug IS NULL OR NEW.slug = '')
EXECUTE FUNCTION generate_connection_slug();

-- Gerar slugs para conexões existentes
UPDATE public.connections
SET slug = NULL
WHERE slug IS NULL OR slug = '';