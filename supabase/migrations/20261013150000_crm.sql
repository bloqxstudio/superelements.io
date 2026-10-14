-- CRM da equipe (2026-10-13)
--
-- A frente comercial ao lado da produção (o Space): clientes com contatos e
-- linha do tempo, e as oportunidades num funil (kanban). Tudo pertence a uma
-- equipe, a empresa que vende (hoje a Avence Studio); quem entra na equipe é
-- convidado pela própria plataforma, com um link, como nos projetos.
--
-- Papéis na equipe: `owner` criou a equipe; `admin` gerencia pessoas e funis;
-- `seller` (vendedor) trabalha clientes e oportunidades. Criar uma equipe é só
-- do admin da plataforma (user_roles), por enquanto.
--
-- O funil da Prospecção sai do arquivo JSON do bucket para estas tabelas:
-- cada cartão vira um cliente e uma oportunidade, e cada mudança grava só a
-- linha que mudou (duas pessoas no mesmo funil não se sobrescrevem mais). As
-- buscas continuam em arquivo, na pasta da equipe: `crm/<equipe>/...`.

-- ---------- equipe ----------

create table public.crm_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_team_members (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'seller' check (role in ('owner', 'admin', 'seller')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index crm_team_members_user_idx on public.crm_team_members (user_id);

-- Convite por link: o id é o segredo; vale para uma pessoa e expira em 7 dias
create table public.crm_team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  -- Para quem é (nome ou e-mail), só para quem convidou se lembrar
  label text not null default '' check (char_length(label) <= 120),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

create index crm_team_invites_team_idx on public.crm_team_invites (team_id, created_at desc);

-- Papel de quem chama na equipe ('owner', 'admin', 'seller' ou null).
-- Security definer para as políticas perguntarem sem cair em recursão.
create or replace function public.crm_team_role(p_team uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.crm_team_members m where m.team_id = p_team and m.user_id = (select auth.uid())
$$;

create or replace function public.is_crm_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_team_role(p_team) is not null
$$;

create or replace function public.is_crm_manager(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.crm_team_role(p_team) in ('owner', 'admin'), false)
$$;

revoke all on function public.crm_team_role(uuid) from public;
revoke all on function public.is_crm_member(uuid) from public;
revoke all on function public.is_crm_manager(uuid) from public;
grant execute on function public.crm_team_role(uuid) to authenticated;
grant execute on function public.is_crm_member(uuid) to authenticated;
grant execute on function public.is_crm_manager(uuid) to authenticated;

-- ---------- funis, clientes, contatos, oportunidades, linha do tempo ----------

-- Um funil por enquanto ("Prospecção"); a tabela já deixa criar outros
create table public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  -- Valor padrão do serviço, do plano mensal e meses que entram no valor (FunnelSettings)
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_pipelines_team_idx on public.crm_pipelines (team_id, position);

-- A empresa (ou pessoa) com quem a equipe conversa: lead até fechar, cliente depois
create table public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  -- CNPJ ou CPF
  document text,
  website text,
  domain text,
  segment text,
  city text,
  address text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  source text not null default 'outro' check (source in ('prospeccao', 'indicacao', 'instagram', 'site', 'anuncio', 'outro')),
  status text not null default 'lead' check (status in ('lead', 'cliente', 'ex-cliente')),
  owner_id uuid references auth.users (id) on delete set null,
  notes text,
  -- Id da empresa na busca da Prospecção (`google:…`), para não entrar duas vezes
  prospect_key text,
  -- A empresa como a busca a viu: site, plataforma, anúncios, nota (Lead)
  lead jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, prospect_key)
);

create index crm_clients_team_idx on public.crm_clients (team_id, updated_at desc);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  client_id uuid not null references public.crm_clients (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  -- Cargo ou relação com a empresa ("sócia", "secretária")
  role text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_contacts_client_idx on public.crm_contacts (client_id);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines (id) on delete cascade,
  client_id uuid not null references public.crm_clients (id) on delete cascade,
  -- A empresa da busca (`google:…`): a mesma não entra duas vezes no mesmo funil
  key text,
  -- Etapas do funil de prospecção: mapeado, selecionado, pagina, contatado, conversa, proposta, fechado, perdido
  stage text not null default 'mapeado' check (char_length(stage) between 1 and 40),
  offer jsonb,
  brief jsonb,
  -- A página que a IA está criando (ou criou) pelo ▶ da fila: projeto, agente e início
  build jsonb,
  project_id uuid references public.space_projects (id) on delete set null,
  project_name text,
  video text,
  next_step text,
  next_date date,
  notes text,
  search_id text,
  region text not null default '',
  owner_id uuid references auth.users (id) on delete set null,
  -- Etapas por onde passou ({ at, stage }), gravadas pelo banco a cada mudança
  history jsonb not null default '[]'::jsonb,
  closed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, key)
);

create index crm_opportunities_pipeline_idx on public.crm_opportunities (pipeline_id, stage);
create index crm_opportunities_client_idx on public.crm_opportunities (client_id);
create index crm_opportunities_team_idx on public.crm_opportunities (team_id);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  client_id uuid not null references public.crm_clients (id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities (id) on delete set null,
  kind text not null default 'note' check (kind in ('note', 'call', 'whatsapp', 'email', 'meeting', 'stage', 'created')),
  body text not null default '' check (char_length(body) <= 8000),
  -- `stage`: { from, to }
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index crm_activities_client_idx on public.crm_activities (client_id, created_at desc);
create index crm_activities_team_idx on public.crm_activities (team_id, created_at desc);

-- ---------- regras gravadas pelo banco ----------

create or replace function public.crm_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger crm_teams_touch before update on public.crm_teams for each row execute function public.crm_touch();
create trigger crm_pipelines_touch before update on public.crm_pipelines for each row execute function public.crm_touch();
create trigger crm_clients_touch before update on public.crm_clients for each row execute function public.crm_touch();
create trigger crm_contacts_touch before update on public.crm_contacts for each row execute function public.crm_touch();

-- A equipe de um contato ou de uma atividade é sempre a do cliente
create or replace function public.crm_team_from_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.team_id into new.team_id from public.crm_clients c where c.id = new.client_id;
  if new.team_id is null then
    raise exception 'cliente_inexistente';
  end if;
  return new;
end
$$;

create trigger crm_contacts_team before insert or update of client_id, team_id on public.crm_contacts
  for each row execute function public.crm_team_from_client();
create trigger crm_activities_team before insert or update of client_id, team_id on public.crm_activities
  for each row execute function public.crm_team_from_client();

-- Oportunidade: a equipe vem do funil, o cliente é da mesma equipe, e cada
-- mudança de etapa entra no histórico (e fecha a data quando ganha ou perde)
create or replace function public.crm_opportunity_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.team_id into new.team_id from public.crm_pipelines p where p.id = new.pipeline_id;
  if new.team_id is null then
    raise exception 'funil_inexistente';
  end if;
  if not exists (select 1 from public.crm_clients c where c.id = new.client_id and c.team_id = new.team_id) then
    raise exception 'cliente_de_outra_equipe';
  end if;
  if tg_op = 'INSERT' then
    if new.history is null or jsonb_array_length(new.history) = 0 then
      new.history := jsonb_build_array(jsonb_build_object('at', now(), 'stage', new.stage));
    end if;
    if new.stage in ('fechado', 'perdido') then
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
    end if;
    return new;
  end if;

  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.history := coalesce(old.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'stage', new.stage));
    new.closed_at := case when new.stage in ('fechado', 'perdido') then now() end;
  end if;
  return new;
end
$$;

create trigger crm_opportunities_rules before insert or update on public.crm_opportunities
  for each row execute function public.crm_opportunity_rules();

-- A linha do tempo do cliente registra a entrada no funil e cada mudança de etapa
create or replace function public.crm_opportunity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Com a data da oportunidade: o que veio importado do funil antigo mantém a data de entrada
    insert into public.crm_activities (team_id, client_id, opportunity_id, kind, data, created_by, created_at)
    values (new.team_id, new.client_id, new.id, 'created', jsonb_build_object('to', new.stage), auth.uid(), new.created_at);
  elsif new.stage is distinct from old.stage then
    insert into public.crm_activities (team_id, client_id, opportunity_id, kind, data, created_by)
    values (new.team_id, new.client_id, new.id, 'stage', jsonb_build_object('from', old.stage, 'to', new.stage), auth.uid());
  end if;
  return null;
end
$$;

create trigger crm_opportunities_log after insert or update of stage on public.crm_opportunities
  for each row execute function public.crm_opportunity_log();

-- Quem criou a equipe continua dono: o papel não muda nem sai por engano
create or replace function public.crm_keep_owner()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- Apagar a equipe inteira apaga o dono junto (cascata): isso pode
    if tg_op = 'DELETE' and not exists (select 1 from public.crm_teams t where t.id = old.team_id) then
      return old;
    end if;
    raise exception 'dono_fixo';
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and old.role <> 'owner' then
    raise exception 'dono_fixo';
  end if;
  return coalesce(new, old);
end
$$;

create trigger crm_team_members_keep_owner before update or delete on public.crm_team_members
  for each row execute function public.crm_keep_owner();

-- ---------- acesso ----------

alter table public.crm_teams enable row level security;
alter table public.crm_team_members enable row level security;
alter table public.crm_team_invites enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_activities enable row level security;

-- Equipe: quem é dela vê; quem gerencia renomeia; só o dono apaga. Criar é pela função.
create policy "Equipe vê a equipe" on public.crm_teams
  for select to authenticated using (public.is_crm_member(id));
create policy "Gestor renomeia a equipe" on public.crm_teams
  for update to authenticated using (public.is_crm_manager(id)) with check (public.is_crm_manager(id));
create policy "Dono apaga a equipe" on public.crm_teams
  for delete to authenticated using (public.crm_team_role(id) = 'owner');

-- Pessoas: a equipe vê; quem gerencia muda o papel e tira alguém; cada um pode sair.
-- Ninguém entra direto: é pelo convite (accept_crm_invite).
create policy "Equipe vê as pessoas" on public.crm_team_members
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor muda o papel" on public.crm_team_members
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id) and role in ('admin', 'seller'));
create policy "Gestor tira e cada um sai" on public.crm_team_members
  for delete to authenticated using (public.is_crm_manager(team_id) or user_id = (select auth.uid()));

create policy "Gestor vê os convites" on public.crm_team_invites
  for select to authenticated using (public.is_crm_manager(team_id));
create policy "Gestor convida" on public.crm_team_invites
  for insert to authenticated with check (public.is_crm_manager(team_id) and created_by = (select auth.uid()));
create policy "Gestor cancela convites" on public.crm_team_invites
  for delete to authenticated using (public.is_crm_manager(team_id));

-- Funis: a equipe vê e ajusta os valores padrão; criar e apagar funil é de quem gerencia
create policy "Equipe vê os funis" on public.crm_pipelines
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe ajusta o funil" on public.crm_pipelines
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Gestor cria funis" on public.crm_pipelines
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor apaga funis" on public.crm_pipelines
  for delete to authenticated using (public.is_crm_manager(team_id));

-- Clientes: a equipe trabalha; apagar um cliente (e tudo dele) é de quem gerencia
create policy "Equipe vê os clientes" on public.crm_clients
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cadastra clientes" on public.crm_clients
  for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe edita clientes" on public.crm_clients
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Gestor apaga clientes" on public.crm_clients
  for delete to authenticated using (public.is_crm_manager(team_id));

create policy "Equipe vê os contatos" on public.crm_contacts
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cadastra contatos" on public.crm_contacts
  for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe edita contatos" on public.crm_contacts
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Equipe apaga contatos" on public.crm_contacts
  for delete to authenticated using (public.is_crm_member(team_id));

create policy "Equipe vê as oportunidades" on public.crm_opportunities
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cria oportunidades" on public.crm_opportunities
  for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe move oportunidades" on public.crm_opportunities
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Equipe tira oportunidades" on public.crm_opportunities
  for delete to authenticated using (public.is_crm_member(team_id));

-- Linha do tempo: a equipe lê e anota; cada um apaga a sua anotação (quem gerencia, qualquer uma)
create policy "Equipe vê a linha do tempo" on public.crm_activities
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe anota" on public.crm_activities
  for insert to authenticated with check (public.is_crm_member(team_id) and kind in ('note', 'call', 'whatsapp', 'email', 'meeting'));
create policy "Autor edita a anotação" on public.crm_activities
  for update to authenticated using (created_by = (select auth.uid()) and kind not in ('stage', 'created')) with check (created_by = (select auth.uid()));
create policy "Autor ou gestor apaga a anotação" on public.crm_activities
  for delete to authenticated using (kind not in ('stage', 'created') and (created_by = (select auth.uid()) or public.is_crm_manager(team_id)));

-- ---------- funções da tela ----------

-- Criar a equipe (só o admin da plataforma, por enquanto): quem cria vira dono,
-- e a equipe já nasce com o funil "Prospecção"
create or replace function public.create_crm_team(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  team uuid;
begin
  if uid is null then
    raise exception 'login_necessario';
  end if;
  if not coalesce(public.has_role(uid, 'admin'), false) then
    raise exception 'so_admin_cria_equipe';
  end if;
  insert into public.crm_teams (name, created_by) values (btrim(p_name), uid) returning id into team;
  insert into public.crm_team_members (team_id, user_id, role) values (team, uid, 'owner');
  insert into public.crm_pipelines (team_id, name) values (team, 'Prospecção');
  return team;
end
$$;

revoke all on function public.create_crm_team(text) from public;
grant execute on function public.create_crm_team(text) to authenticated;

-- Pessoas da equipe com o e-mail da conta (o dono primeiro); só para quem é da equipe
create or replace function public.crm_team_people(p_team uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, coalesce(u.email, '')::text, m.role, m.created_at
  from public.crm_team_members m
  left join auth.users u on u.id = m.user_id
  where m.team_id = p_team and public.is_crm_member(p_team)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
$$;

revoke all on function public.crm_team_people(uuid) from public;
grant execute on function public.crm_team_people(uuid) to authenticated;

-- Página do convite: o que quem abriu o link pode saber antes de entrar
create or replace function public.get_crm_invite(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'team_id', case when public.is_crm_member(i.team_id) then i.team_id end,
    'team_name', t.name,
    'role', i.role,
    'invited_by', coalesce(u.email, ''),
    'expires_at', i.expires_at,
    'status', case
      when public.is_crm_member(i.team_id) then 'member'
      when i.accepted_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  )
  from public.crm_team_invites i
  join public.crm_teams t on t.id = i.team_id
  left join auth.users u on u.id = i.created_by
  where i.id = p_id
$$;

revoke all on function public.get_crm_invite(uuid) from public;
grant execute on function public.get_crm_invite(uuid) to anon, authenticated;

-- Entrar na equipe pelo convite; devolve o id da equipe
create or replace function public.accept_crm_invite(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite record;
begin
  if uid is null then
    raise exception 'login_necessario';
  end if;
  select i.id, i.team_id, i.role, i.created_by, i.expires_at, i.accepted_at into invite
  from public.crm_team_invites i
  where i.id = p_id
  for update;
  if not found then
    raise exception 'convite_inativo';
  end if;
  -- Quem já é da equipe (quem convidou testando o link) não gasta o convite
  if public.is_crm_member(invite.team_id) then
    return invite.team_id;
  end if;
  if invite.accepted_at is not null then
    raise exception 'convite_usado';
  end if;
  if invite.expires_at < now() then
    raise exception 'convite_expirado';
  end if;

  insert into public.crm_team_members (team_id, user_id, role, invited_by)
  values (invite.team_id, uid, invite.role, invite.created_by);
  update public.crm_team_invites set accepted_by = uid, accepted_at = now() where id = p_id;
  return invite.team_id;
end
$$;

revoke all on function public.accept_crm_invite(uuid) from public;
grant execute on function public.accept_crm_invite(uuid) to authenticated;

-- ---------- arquivos da equipe (buscas da Prospecção) ----------

-- `crm/<equipe>/...` no bucket `space-projects`, para quem é da equipe
create or replace function public.can_use_crm_file(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folders text[] := storage.foldername(p_name);
begin
  if coalesce(folders[1], '') <> 'crm' or coalesce(folders[2], '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_crm_member(folders[2]::uuid);
end
$$;

revoke all on function public.can_use_crm_file(text) from public;
grant execute on function public.can_use_crm_file(text) to authenticated;

create policy "Equipe lê os arquivos do CRM" on storage.objects
  for select to authenticated using (bucket_id = 'space-projects' and public.can_use_crm_file(name));
create policy "Equipe envia arquivos do CRM" on storage.objects
  for insert to authenticated with check (bucket_id = 'space-projects' and public.can_use_crm_file(name));
create policy "Equipe troca arquivos do CRM" on storage.objects
  for update to authenticated using (bucket_id = 'space-projects' and public.can_use_crm_file(name)) with check (bucket_id = 'space-projects' and public.can_use_crm_file(name));
create policy "Equipe apaga arquivos do CRM" on storage.objects
  for delete to authenticated using (bucket_id = 'space-projects' and public.can_use_crm_file(name));

-- ---------- ao vivo ----------

-- Quem está no funil vê o cartão que outra pessoa moveu, sem recarregar.
-- `replica identity full`: a exclusão chega com a equipe e o funil da linha.
alter table public.crm_opportunities replica identity full;
alter table public.crm_clients replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.crm_opportunities, public.crm_clients, public.crm_activities;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Sem a publicação supabase_realtime: o CRM funciona, só não atualiza sozinho';
end
$$;
