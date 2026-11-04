-- Endereço bonito para o link direto do formulário (2026-11-04)
--
-- O usuário: "publicar esse formulário sem site, apenas ele dentro do app… destino dos anúncios…
-- configurar o slug pra ficar bonitinho". `/f/<slug>` abre o mesmo formulário que `/f/<id>`.
-- O slug é único na plataforma (o endereço é um só para todas as contas): minúsculas, números e
-- hífens, de 3 a 60 caracteres. A página pública resolve o slug pela função abaixo, que só devolve
-- formulários publicados de contas ativas com o módulo de formulários ligado.

alter table public.crm_forms add column if not exists slug text;

alter table public.crm_forms drop constraint if exists crm_forms_slug_format;
alter table public.crm_forms add constraint crm_forms_slug_format
  check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$');

create unique index if not exists crm_forms_slug_idx on public.crm_forms (slug) where slug is not null;

create or replace function public.crm_form_by_slug(p_slug text)
returns table (id uuid, team_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.team_id
  from public.crm_forms f
  join public.crm_teams t on t.id = f.team_id
  where f.slug = lower(btrim(p_slug))
    and f.status = 'published'
    and t.status = 'ativa'
    and coalesce((t.modules ->> 'formularios')::boolean, true)
  limit 1
$$;

revoke all on function public.crm_form_by_slug(text) from public;
grant execute on function public.crm_form_by_slug(text) to anon, authenticated;
