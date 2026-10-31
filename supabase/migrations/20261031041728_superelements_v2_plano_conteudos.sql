-- Superelements v2, primeiro incremento (2026-10-31): Plano da empresa e Conteúdos
--
--   * `crm_account_context`: o contexto compartilhado da conta (oferta, público, tom, objetivo,
--     pilares, restrições). Um registro por conta, com versão e controle otimista. Todos os
--     membros leem; só dono e gestor gravam.
--   * `crm_contents`: a ideia → produção → revisão → aprovado de cada conteúdo. A aprovação
--     guarda a versão e o hash exatos do que foi aprovado; qualquer edição do texto a invalida.
--   * `crm_content_snapshots`: cópia imutável do texto (e do contexto) a cada submissão e aprovação.
--   * `crm_content_links`: o vínculo com o documento do Copy ou o conjunto de Criativos (que vivem
--     no Storage, fora do banco). O hash do material ligado é informado pelo navegador: serve para
--     avisar que o material mudou, não como prova. A aprovação cobre só o texto do conteúdo.
--
-- Ninguém grava nestas tabelas direto: não há política de escrita; tudo passa pelas funções
-- abaixo (security definer, search_path fixo, `auth.uid()` validado, conta e módulo `copy`
-- conferidos, versão esperada obrigatória). O módulo `copy` ligado (e a conta ativa) vale
-- também para ler. Não entra no Realtime.

-- ---------- contexto da conta ----------

create table public.crm_account_context (
  team_id uuid primary key references public.crm_teams (id) on delete cascade,
  offer text not null default '' check (length(offer) <= 2000),
  audience text not null default '' check (length(audience) <= 2000),
  tone text not null default '' check (length(tone) <= 1000),
  goal text not null default '' check (length(goal) <= 1000),
  restrictions text not null default '' check (length(restrictions) <= 2000),
  pillars jsonb not null default '[]'::jsonb check (jsonb_typeof(pillars) = 'array' and jsonb_array_length(pillars) <= 8),
  version integer not null default 1 check (version >= 1),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.crm_account_context_versions (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  -- UUID histórico, sem chave para auth.users: o log é imutável e um `on delete set null` (um UPDATE)
  -- travaria a exclusão de quem salvou o contexto
  saved_by uuid,
  saved_at timestamptz not null default now(),
  primary key (team_id, version)
);

-- ---------- conteúdos ----------

create table public.crm_contents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  idea text not null default '' check (length(idea) <= 4000),
  goal text not null default '' check (length(goal) <= 600),
  format text not null default 'post-instagram'
    check (format in ('post-instagram', 'carrossel', 'story', 'reels', 'linkedin', 'lp', 'anuncio', 'email', 'whatsapp', 'artigo', 'livre')),
  script text not null default '' check (length(script) <= 20000),
  editorial_date date,
  status text not null default 'ideia' check (status in ('ideia', 'producao', 'revisao', 'aprovado')),
  version integer not null default 1 check (version >= 1),
  -- Hash do que a aprovação cobre: título, formato, objetivo, ideia e roteiro (não a data editorial)
  content_hash text not null,
  approved_version integer,
  approved_hash text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  -- Aprovado é só o que tem registro de aprovação do hash atual: não há como ficar "aprovado" velho
  constraint crm_contents_approval_ck check (
    (status = 'aprovado') = (approved_version is not null and approved_hash is not null)
    and (status <> 'aprovado' or approved_hash = content_hash)
  )
);

create index crm_contents_team_idx on public.crm_contents (team_id, updated_at desc);

create table public.crm_content_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  team_id uuid not null,
  kind text not null check (kind in ('submissao', 'aprovacao')),
  content_version integer not null,
  content_hash text not null,
  -- title, format, goal, idea, script exatamente como estavam
  payload jsonb not null,
  context_version integer,
  context jsonb,
  -- O que estava ligado (hash informado pelo navegador, não verificado pelo servidor)
  links jsonb not null default '[]'::jsonb,
  -- UUID histórico (quem submeteu ou aprovou), sem chave para auth.users, pelo mesmo motivo do log de contexto
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (content_id, team_id) references public.crm_contents (id, team_id) on delete cascade
);

create index crm_content_snapshots_idx on public.crm_content_snapshots (content_id, created_at desc);

create table public.crm_content_links (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  team_id uuid not null,
  kind text not null check (kind in ('copy', 'criativos')),
  artifact_id text not null check (length(artifact_id) between 1 and 80),
  project_id uuid references public.space_projects (id) on delete set null,
  linked_hash text not null default '' check (length(linked_hash) <= 128),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_id, team_id) references public.crm_contents (id, team_id) on delete cascade,
  unique (content_id, kind),
  unique (team_id, kind, artifact_id)
);

-- ---------- leitura (RLS) e nenhum caminho de escrita direto ----------

alter table public.crm_account_context enable row level security;
alter table public.crm_account_context_versions enable row level security;
alter table public.crm_contents enable row level security;
alter table public.crm_content_snapshots enable row level security;
alter table public.crm_content_links enable row level security;

create policy "Membros leem o contexto" on public.crm_account_context
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem as versões do contexto" on public.crm_account_context_versions
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem os conteúdos" on public.crm_contents
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem os registros dos conteúdos" on public.crm_content_snapshots
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem os vínculos dos conteúdos" on public.crm_content_links
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));

revoke all on public.crm_account_context, public.crm_account_context_versions, public.crm_contents,
  public.crm_content_snapshots, public.crm_content_links from anon, authenticated;
grant select on public.crm_account_context, public.crm_account_context_versions, public.crm_contents,
  public.crm_content_snapshots, public.crm_content_links to authenticated;

-- Versões do contexto e snapshots não mudam nem somem (só saem junto com a conta ou o conteúdo, em cascata)
create or replace function public.crm_v2_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'registro_imutavel' using errcode = '42501';
end
$$;

create trigger crm_account_context_versions_immutable before update or delete on public.crm_account_context_versions
  for each row execute function public.crm_v2_immutable();
create trigger crm_content_snapshots_immutable before update or delete on public.crm_content_snapshots
  for each row execute function public.crm_v2_immutable();

-- ---------- ajudantes internos ----------

-- Hash do que a aprovação cobre. jsonb tem texto canônico, então o mesmo conteúdo dá sempre o mesmo hash.
create or replace function public.crm_content_hash(p_title text, p_format text, p_goal text, p_idea text, p_script text)
returns text
language sql
immutable
set search_path = public
as $$
  select md5(jsonb_build_object('title', p_title, 'format', p_format, 'goal', p_goal, 'idea', p_idea, 'script', p_script)::text)
$$;

revoke all on function public.crm_content_hash(text, text, text, text, text) from public, anon, authenticated;

-- Quem chama é membro da conta, a conta está ativa e o módulo copy está ligado (ou levanta o erro).
create or replace function public.crm_v2_require(p_team uuid, p_manager boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not public.is_crm_member(p_team) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not public.crm_module_on(p_team, 'copy') then
    raise exception 'modulo_desligado' using errcode = '42501';
  end if;
  if p_manager and not public.is_crm_manager(p_team) then
    raise exception 'so_gestor' using errcode = '42501';
  end if;
  return me;
end
$$;

revoke all on function public.crm_v2_require(uuid, boolean) from public, anon, authenticated;

create or replace function public.crm_v2_text(p_data jsonb, p_key text, p_max integer, p_required boolean default false)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if jsonb_typeof(p_data -> p_key) is distinct from 'string' then
    if p_required then
      raise exception 'campo_invalido:%', p_key;
    end if;
    return '';
  end if;
  v := p_data ->> p_key;
  if length(v) > p_max then
    raise exception 'campo_longo:%', p_key;
  end if;
  if p_required and length(btrim(v)) = 0 then
    raise exception 'campo_invalido:%', p_key;
  end if;
  return v;
end
$$;

revoke all on function public.crm_v2_text(jsonb, text, integer, boolean) from public, anon, authenticated;

-- ---------- contexto: gravar com a versão esperada ----------
-- p_expected = 0 cria o primeiro registro; senão precisa ser a versão que a pessoa viu.

create or replace function public.crm_context_save(p_team uuid, p_expected integer, p_data jsonb)
returns public.crm_account_context
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.crm_v2_require(p_team, true);
  cur public.crm_account_context;
  pil jsonb := '[]'::jsonb;
  item jsonb;
  res public.crm_account_context;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'campo_invalido:dados';
  end if;
  if jsonb_typeof(p_data -> 'pillars') = 'array' then
    if jsonb_array_length(p_data -> 'pillars') > 8 then
      raise exception 'campo_longo:pillars';
    end if;
    for item in select * from jsonb_array_elements(p_data -> 'pillars') loop
      if jsonb_typeof(item) = 'string' then
        if length(btrim(item #>> '{}')) > 60 then
          raise exception 'campo_longo:pillars';
        elsif length(btrim(item #>> '{}')) >= 1 then
          pil := pil || to_jsonb(btrim(item #>> '{}'));
        end if;
      end if;
    end loop;
  end if;

  -- Serializa gravações simultâneas do primeiro registro da conta
  perform 1 from public.crm_teams where id = p_team for update;
  select * into cur from public.crm_account_context where team_id = p_team for update;

  if not found then
    if coalesce(p_expected, -1) <> 0 then
      raise exception 'conflito_de_versao';
    end if;
    insert into public.crm_account_context (team_id, offer, audience, tone, goal, restrictions, pillars, version, updated_by)
    values (p_team, public.crm_v2_text(p_data, 'offer', 2000), public.crm_v2_text(p_data, 'audience', 2000), public.crm_v2_text(p_data, 'tone', 1000),
            public.crm_v2_text(p_data, 'goal', 1000), public.crm_v2_text(p_data, 'restrictions', 2000), pil, 1, me)
    returning * into res;
  else
    if cur.version is distinct from p_expected then
      raise exception 'conflito_de_versao';
    end if;
    update public.crm_account_context
       set offer = public.crm_v2_text(p_data, 'offer', 2000), audience = public.crm_v2_text(p_data, 'audience', 2000),
           tone = public.crm_v2_text(p_data, 'tone', 1000), goal = public.crm_v2_text(p_data, 'goal', 1000),
           restrictions = public.crm_v2_text(p_data, 'restrictions', 2000), pillars = pil,
           version = cur.version + 1, updated_by = me, updated_at = now()
     where team_id = p_team
     returning * into res;
  end if;

  insert into public.crm_account_context_versions (team_id, version, payload, saved_by)
  values (p_team, res.version, jsonb_build_object('offer', res.offer, 'audience', res.audience, 'tone', res.tone, 'goal', res.goal, 'restrictions', res.restrictions, 'pillars', res.pillars), me);

  return res;
end
$$;

revoke all on function public.crm_context_save(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_context_save(uuid, integer, jsonb) to authenticated;

-- ---------- conteúdos ----------

create or replace function public.crm_content_create(p_team uuid, p_data jsonb)
returns public.crm_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.crm_v2_require(p_team, false);
  v_title text;
  v_idea text;
  v_goal text;
  v_format text;
  v_script text;
  v_date date;
  res public.crm_contents;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'campo_invalido:dados';
  end if;
  v_title := btrim(public.crm_v2_text(p_data, 'title', 160, true));
  v_idea := public.crm_v2_text(p_data, 'idea', 4000);
  v_goal := public.crm_v2_text(p_data, 'goal', 600);
  v_script := public.crm_v2_text(p_data, 'script', 20000);
  v_format := coalesce(nullif(p_data ->> 'format', ''), 'post-instagram');
  if jsonb_typeof(p_data -> 'editorialDate') = 'string' and (p_data ->> 'editorialDate') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_date := (p_data ->> 'editorialDate')::date;
  end if;
  insert into public.crm_contents (team_id, title, idea, goal, format, script, editorial_date, content_hash, created_by)
  values (p_team, v_title, v_idea, v_goal, v_format, v_script, v_date, public.crm_content_hash(v_title, v_format, v_goal, v_idea, v_script), me)
  returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_create(uuid, jsonb) from public, anon;
grant execute on function public.crm_content_create(uuid, jsonb) to authenticated;

-- Editar: exige a versão que a pessoa viu. Mudar o texto de um conteúdo aprovado derruba a aprovação.
create or replace function public.crm_content_save(p_id uuid, p_expected integer, p_data jsonb)
returns public.crm_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.crm_contents;
  tid uuid;
  v_title text;
  v_idea text;
  v_goal text;
  v_format text;
  v_script text;
  v_date date;
  v_hash text;
  v_status text;
  res public.crm_contents;
begin
  select team_id into tid from public.crm_contents where id = p_id;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(tid, false);
  select * into cur from public.crm_contents where id = p_id for update;
  if cur.version is distinct from p_expected then
    raise exception 'conflito_de_versao';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'campo_invalido:dados';
  end if;

  v_title := case when p_data ? 'title' then btrim(public.crm_v2_text(p_data, 'title', 160, true)) else cur.title end;
  v_idea := case when p_data ? 'idea' then public.crm_v2_text(p_data, 'idea', 4000) else cur.idea end;
  v_goal := case when p_data ? 'goal' then public.crm_v2_text(p_data, 'goal', 600) else cur.goal end;
  v_script := case when p_data ? 'script' then public.crm_v2_text(p_data, 'script', 20000) else cur.script end;
  v_format := case when p_data ? 'format' then coalesce(nullif(p_data ->> 'format', ''), cur.format) else cur.format end;
  v_date := cur.editorial_date;
  if p_data ? 'editorialDate' then
    if jsonb_typeof(p_data -> 'editorialDate') = 'string' and (p_data ->> 'editorialDate') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_date := (p_data ->> 'editorialDate')::date;
    else
      v_date := null;
    end if;
  end if;

  v_hash := public.crm_content_hash(v_title, v_format, v_goal, v_idea, v_script);
  v_status := cur.status;
  if v_hash is distinct from cur.content_hash and cur.status = 'aprovado' then
    v_status := 'producao';
  end if;

  update public.crm_contents
     set title = v_title, idea = v_idea, goal = v_goal, format = v_format, script = v_script, editorial_date = v_date,
         content_hash = v_hash, status = v_status, version = cur.version + 1, updated_at = now(),
         approved_version = case when v_status = 'aprovado' then cur.approved_version end,
         approved_hash = case when v_status = 'aprovado' then cur.approved_hash end,
         approved_by = case when v_status = 'aprovado' then cur.approved_by end,
         approved_at = case when v_status = 'aprovado' then cur.approved_at end
   where id = p_id
   returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_save(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_content_save(uuid, integer, jsonb) to authenticated;

-- Mudar de estado. Aprovar é só de dono e gestor, vem de "em revisão" e grava o snapshot.
--   ideia ⇄ producao → revisao → aprovado;  revisao → producao (pedir ajustes);  aprovado → producao (reabrir)
create or replace function public.crm_content_transition(p_id uuid, p_expected integer, p_to text)
returns public.crm_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.crm_contents;
  tid uuid;
  me uuid;
  ctx public.crm_account_context;
  links_json jsonb;
  res public.crm_contents;
begin
  select team_id into tid from public.crm_contents where id = p_id;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_v2_require(tid, p_to = 'aprovado');
  select * into cur from public.crm_contents where id = p_id for update;
  if cur.version is distinct from p_expected then
    raise exception 'conflito_de_versao';
  end if;

  if not ((cur.status, p_to) in (
    ('ideia', 'producao'), ('producao', 'ideia'), ('producao', 'revisao'),
    ('revisao', 'producao'), ('revisao', 'aprovado'), ('aprovado', 'producao')
  )) then
    raise exception 'transicao_invalida';
  end if;
  if p_to = 'revisao' and length(btrim(cur.script)) = 0 then
    raise exception 'roteiro_vazio';
  end if;

  if p_to in ('revisao', 'aprovado') then
    select * into ctx from public.crm_account_context where team_id = tid;
    select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'artifactId', l.artifact_id, 'projectId', l.project_id, 'hash', l.linked_hash, 'hashSource', 'navegador')), '[]'::jsonb)
      into links_json from public.crm_content_links l where l.content_id = p_id;
    insert into public.crm_content_snapshots (content_id, team_id, kind, content_version, content_hash, payload, context_version, context, links, created_by)
    values (
      p_id, tid, case when p_to = 'revisao' then 'submissao' else 'aprovacao' end, cur.version + 1, cur.content_hash,
      jsonb_build_object('title', cur.title, 'format', cur.format, 'goal', cur.goal, 'idea', cur.idea, 'script', cur.script),
      ctx.version,
      case when ctx.team_id is null then null else jsonb_build_object('offer', ctx.offer, 'audience', ctx.audience, 'tone', ctx.tone, 'goal', ctx.goal, 'restrictions', ctx.restrictions, 'pillars', ctx.pillars) end,
      links_json, me
    );
  end if;

  update public.crm_contents
     set status = p_to, version = cur.version + 1, updated_at = now(),
         approved_version = case when p_to = 'aprovado' then cur.version + 1 end,
         approved_hash = case when p_to = 'aprovado' then cur.content_hash end,
         approved_by = case when p_to = 'aprovado' then me end,
         approved_at = case when p_to = 'aprovado' then now() end
   where id = p_id
   returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_transition(uuid, integer, text) from public, anon;
grant execute on function public.crm_content_transition(uuid, integer, text) to authenticated;

-- Só o gestor apaga, e nunca um conteúdo aprovado (o registro da aprovação fica)
create or replace function public.crm_content_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.crm_contents;
begin
  select * into cur from public.crm_contents where id = p_id for update;
  if not found then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(cur.team_id, true);
  if cur.status = 'aprovado' then
    raise exception 'conteudo_aprovado';
  end if;
  delete from public.crm_contents where id = p_id;
end
$$;

revoke all on function public.crm_content_delete(uuid) from public, anon;
grant execute on function public.crm_content_delete(uuid) to authenticated;

-- ---------- vínculos com Copy e Criativos ----------
-- Repetir a chamada com o mesmo documento só atualiza o hash (ressincronizar). Outro documento
-- no mesmo conteúdo e tipo é recusado: desligue o vínculo antes de trocar.

create or replace function public.crm_content_link(p_content uuid, p_kind text, p_artifact text, p_project uuid, p_hash text)
returns public.crm_content_links
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  me uuid;
  cur public.crm_content_links;
  res public.crm_content_links;
begin
  select team_id into tid from public.crm_contents where id = p_content;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_v2_require(tid, false);
  if p_kind not in ('copy', 'criativos') then
    raise exception 'campo_invalido:kind';
  end if;
  if p_kind = 'criativos' and not public.crm_module_on(tid, 'criativos') then
    raise exception 'modulo_desligado' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_artifact)), 0) not between 1 and 80 then
    raise exception 'campo_invalido:artifact';
  end if;
  if length(coalesce(p_hash, '')) > 128 then
    raise exception 'campo_longo:hash';
  end if;
  -- O projeto (onde o material compartilhado fica) tem de ser desta conta; projeto antigo sem conta é da conta-casa
  if p_project is not null and not exists (
    select 1 from public.space_projects sp
     where sp.id = p_project
       and (sp.team_id = tid or (sp.team_id is null and exists (select 1 from public.crm_teams t where t.id = tid and t.is_home)))
  ) then
    raise exception 'projeto_de_outra_conta' using errcode = '42501';
  end if;

  perform 1 from public.crm_contents where id = p_content for update;
  select * into cur from public.crm_content_links where content_id = p_content and kind = p_kind;
  if found then
    if cur.artifact_id is distinct from btrim(p_artifact) then
      raise exception 'ja_vinculado';
    end if;
    update public.crm_content_links
       set linked_hash = coalesce(p_hash, ''), project_id = coalesce(p_project, project_id), updated_at = now()
     where id = cur.id returning * into res;
  else
    insert into public.crm_content_links (content_id, team_id, kind, artifact_id, project_id, linked_hash, created_by)
    values (p_content, tid, p_kind, btrim(p_artifact), p_project, coalesce(p_hash, ''), me)
    returning * into res;
  end if;
  return res;
end
$$;

revoke all on function public.crm_content_link(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.crm_content_link(uuid, text, text, uuid, text) to authenticated;

create or replace function public.crm_content_unlink(p_content uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  select team_id into tid from public.crm_contents where id = p_content;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(tid, false);
  delete from public.crm_content_links where content_id = p_content and kind = p_kind;
end
$$;

revoke all on function public.crm_content_unlink(uuid, text) from public, anon;
grant execute on function public.crm_content_unlink(uuid, text) to authenticated;
