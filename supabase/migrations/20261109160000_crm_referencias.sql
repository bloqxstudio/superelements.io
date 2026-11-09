-- Referências visuais da conta (2026-11-09).
--
-- O usuário: "quero ter dentro do sistema uma aba pra referências, pra mandar links de vídeos do Instagram e
-- salvar como referência visual, para conseguir salvar as melhores e enviar pra ideias / produção de
-- criativos… as melhores refs pra aquela empresa, com os links de postagens, pode ser estáticos, vídeos,
-- motion etc."
--
-- Uma linha por referência, por conta (RLS por team_id). Guarda o link, o tipo, por que é boa, etiquetas,
-- a estrela das melhores e, se a pessoa subir, uma captura (arquivo no Cérebro da conta, pasta
-- `referencias/`). O Instagram nunca é raspado (AGENTS.md): a tela mostra o post pelo embed oficial do
-- Instagram, e nada do post é baixado nem guardado.

create table if not exists public.crm_references (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  url text not null check (url ~ '^https?://' and length(url) <= 600),
  platform text not null default 'outro' check (platform in ('instagram', 'tiktok', 'youtube', 'pinterest', 'behance', 'site', 'outro')),
  kind text not null default 'estatico' check (kind in ('estatico', 'carrossel', 'video', 'motion', 'reels', 'story')),
  title text not null default '' check (length(title) <= 160),
  -- Por que é boa: o que copiar dela (vai para a IA)
  notes text not null default '' check (length(notes) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  starred boolean not null default false,
  -- Captura que a pessoa subiu: caminho no Cérebro da conta (`referencias/<arquivo>`)
  media_path text check (media_path is null or (media_path ~ '^referencias/[A-Za-z0-9._-]{1,120}$')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_references_team_idx on public.crm_references (team_id, starred desc, created_at desc);
create unique index if not exists crm_references_team_url_key on public.crm_references (team_id, url);

create or replace function public.crm_references_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.team_id := old.team_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end
$$;

drop trigger if exists crm_references_touch on public.crm_references;
create trigger crm_references_touch before insert or update on public.crm_references
  for each row execute function public.crm_references_touch();

alter table public.crm_references enable row level security;

drop policy if exists "Equipe lê as referências" on public.crm_references;
create policy "Equipe lê as referências" on public.crm_references
  for select to authenticated using (public.is_crm_member(team_id));
drop policy if exists "Equipe salva referências" on public.crm_references;
create policy "Equipe salva referências" on public.crm_references
  for insert to authenticated with check (public.is_crm_member(team_id));
drop policy if exists "Equipe edita referências" on public.crm_references;
create policy "Equipe edita referências" on public.crm_references
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
drop policy if exists "Equipe apaga referências" on public.crm_references;
create policy "Equipe apaga referências" on public.crm_references
  for delete to authenticated using (public.is_crm_member(team_id));
