-- Pauta: calendário editorial com aprovação do cliente (2026-11-05).
--
-- O usuário: "uma ferramenta estilo Pautta… organizar e aprovar uma série de criativos com o
-- cliente… datas, horários, conteúdo de fácil acesso e sistema de aprovação / comentários…
-- enviar pro cliente aprovar". Decisões: a IA ou o designer entrega ao gestor, o gestor aprova
-- (o fluxo que já existe em `crm_contents`), e só então o cliente aprova ou pede ajuste por um
-- link sem login; o cliente aprova e comenta, editar é só da equipe.
--
--   * `crm_contents` ganha horário (`scheduled_time`), canal (`channel`) e o estado do cliente
--     (`client_status`: enviado, aprovado, ajuste). Mudar o texto derruba o estado do cliente,
--     como já derruba a aprovação do gestor.
--   * `crm_approval_links`: um envio (um lote de conteúdos) com endereço público. O id é o segredo.
--   * `crm_approval_items`: a foto de cada conteúdo no envio (texto, data, imagens dos slides em
--     `crm-aprovacao/<conta>/<envio>/…`, hash do conteúdo e do conjunto) e a decisão do cliente.
--     O cliente aprova exatamente o que viu.
--   * `crm_content_comments`: a conversa de cada conteúdo; o cliente comenta pelo link (com o nome
--     que digitar), a equipe responde na Pauta; comentários internos nunca vão para o link.

-- ---------- conteúdos: horário, canal e estado do cliente ----------

alter table public.crm_contents
  add column if not exists scheduled_time time,
  add column if not exists channel text
    check (channel is null or channel in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'site', 'email', 'whatsapp', 'anuncio', 'outro')),
  add column if not exists client_status text check (client_status is null or client_status in ('enviado', 'aprovado', 'ajuste')),
  add column if not exists client_at timestamptz;

-- O cliente aprovou um texto; outro texto precisa de outra aprovação dele
create or replace function public.crm_contents_client_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content_hash is distinct from old.content_hash or (old.status = 'aprovado' and new.status <> 'aprovado') then
    new.client_status := null;
    new.client_at := null;
  end if;
  return new;
end
$$;

drop trigger if exists crm_contents_client_reset on public.crm_contents;
create trigger crm_contents_client_reset before update on public.crm_contents
  for each row execute function public.crm_contents_client_reset();

-- Mudar dia, horário e canal na Pauta (arrastar no calendário). Não mexe no texto nem nas aprovações.
create or replace function public.crm_content_schedule(p_id uuid, p_expected integer, p_date date, p_time time, p_channel text)
returns public.crm_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.crm_contents;
  res public.crm_contents;
begin
  select * into cur from public.crm_contents where id = p_id;
  if cur.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(cur.team_id, false);
  select * into cur from public.crm_contents where id = p_id for update;
  if cur.version is distinct from p_expected then
    raise exception 'conflito_de_versao';
  end if;
  if p_channel is not null and p_channel not in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'site', 'email', 'whatsapp', 'anuncio', 'outro') then
    raise exception 'campo_invalido:canal';
  end if;
  update public.crm_contents
     set editorial_date = p_date,
         scheduled_time = case when p_date is null then null else p_time end,
         channel = nullif(p_channel, ''),
         version = cur.version + 1,
         updated_at = now()
   where id = p_id
   returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_schedule(uuid, integer, date, time, text) from public, anon;
grant execute on function public.crm_content_schedule(uuid, integer, date, time, text) to authenticated;

-- ---------- envios ao cliente ----------

create table public.crm_approval_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  -- Nome da conta na hora do envio: a página pública não lê a conta
  team_name text not null check (length(team_name) <= 160),
  message text not null default '' check (length(message) <= 1000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days',
  revoked_at timestamptz
);

create index crm_approval_links_team_idx on public.crm_approval_links (team_id, created_at desc);

create table public.crm_approval_items (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.crm_approval_links (id) on delete cascade,
  team_id uuid not null,
  content_id uuid not null,
  position integer not null check (position between 0 and 99),
  -- O que foi enviado (cópia: a página pública não depende do conteúdo atual)
  content_version integer not null,
  content_hash text not null,
  set_hash text not null default '' check (length(set_hash) <= 128),
  title text not null,
  format text not null,
  channel text,
  editorial_date date,
  scheduled_time time,
  script text not null default '' check (length(script) <= 20000),
  -- [{ "name", "format", "caption", "slides": ["<conta>/<envio>/<conteúdo>/<arquivo>.jpg", …] }]
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  decision text not null default 'pendente' check (decision in ('pendente', 'aprovado', 'ajuste')),
  decided_name text check (decided_name is null or length(decided_name) <= 120),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (content_id, team_id) references public.crm_contents (id, team_id) on delete cascade,
  unique (link_id, content_id)
);

create index crm_approval_items_content_idx on public.crm_approval_items (content_id, created_at desc);
create index crm_approval_items_team_idx on public.crm_approval_items (team_id, created_at desc);

create table public.crm_content_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  content_id uuid not null,
  -- O envio em que o comentário foi feito (ou ao qual a resposta da equipe vai)
  item_id uuid references public.crm_approval_items (id) on delete set null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null check (length(btrim(author_name)) between 1 and 120),
  from_client boolean not null default false,
  internal boolean not null default false,
  -- Sobre que post (do conjunto) e que slide, contando de 1
  post integer check (post is null or post between 1 and 10),
  slide integer check (slide is null or slide between 1 and 20),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  foreign key (content_id, team_id) references public.crm_contents (id, team_id) on delete cascade,
  check (not (from_client and internal))
);

create index crm_content_comments_content_idx on public.crm_content_comments (content_id, created_at);
create index crm_content_comments_item_idx on public.crm_content_comments (item_id);
create index crm_content_comments_team_idx on public.crm_content_comments (team_id, created_at desc);

alter table public.crm_approval_links enable row level security;
alter table public.crm_approval_items enable row level security;
alter table public.crm_content_comments enable row level security;

create policy "Membros leem os envios" on public.crm_approval_links
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem os itens enviados" on public.crm_approval_items
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));
create policy "Membros leem os comentários" on public.crm_content_comments
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));

revoke all on public.crm_approval_links, public.crm_approval_items, public.crm_content_comments from anon, authenticated;
grant select on public.crm_approval_links, public.crm_approval_items, public.crm_content_comments to authenticated;

-- ---------- funções da equipe ----------

-- O nome que aparece nos comentários da equipe
create or replace function public.crm_person_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(btrim(p.full_name), ''), nullif(split_part(p.email, '@', 1), '')) from public.profiles p where p.id = p_user),
    'Equipe'
  )
$$;

revoke all on function public.crm_person_name(uuid) from public, anon, authenticated;

-- Enviar ao cliente: só gestor, só conteúdos aprovados pelo gestor, imagens já enviadas à pasta do envio.
-- p_items: [{ "contentId", "setHash", "media": [{ "name", "format", "caption", "slides": [caminhos] }] }]
create or replace function public.crm_approval_create(p_team uuid, p_link uuid, p_title text, p_message text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.crm_v2_require(p_team, true);
  v_team text;
  it jsonb;
  m jsonb;
  s jsonb;
  pos integer := 0;
  cur public.crm_contents;
  v_media jsonb;
  v_post jsonb;
  v_slides jsonb;
  prefix text := p_team::text || '/' || p_link::text || '/';
begin
  if p_link is null then
    raise exception 'campo_invalido:envio';
  end if;
  if coalesce(length(btrim(p_title)), 0) not between 1 and 120 then
    raise exception 'campo_invalido:titulo';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'campo_invalido:itens';
  end if;
  select name into v_team from public.crm_teams where id = p_team;

  insert into public.crm_approval_links (id, team_id, title, team_name, message, created_by)
  values (p_link, p_team, btrim(p_title), left(coalesce(v_team, ''), 160), left(coalesce(btrim(p_message), ''), 1000), me);

  for it in select value from jsonb_array_elements(p_items) loop
    select * into cur from public.crm_contents
     where id = nullif(it ->> 'contentId', '')::uuid and team_id = p_team
     for update;
    if cur.id is null then
      raise exception 'nao_encontrado' using errcode = 'P0002';
    end if;
    if cur.status <> 'aprovado' then
      raise exception 'nao_aprovado';
    end if;

    v_media := '[]'::jsonb;
    if jsonb_typeof(it -> 'media') = 'array' then
      if jsonb_array_length(it -> 'media') > 10 then
        raise exception 'campo_invalido:media';
      end if;
      for m in select value from jsonb_array_elements(it -> 'media') loop
        v_slides := '[]'::jsonb;
        if jsonb_typeof(m -> 'slides') <> 'array' or jsonb_array_length(m -> 'slides') > 20 then
          raise exception 'campo_invalido:slides';
        end if;
        for s in select value from jsonb_array_elements(m -> 'slides') loop
          if jsonb_typeof(s) <> 'string'
             or left(s #>> '{}', length(prefix)) <> prefix
             or (s #>> '{}') !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(jpg|png)$' then
            raise exception 'campo_invalido:arquivo';
          end if;
          v_slides := v_slides || jsonb_build_array(s);
        end loop;
        v_post := jsonb_build_object(
          'name', left(coalesce(m ->> 'name', ''), 120),
          'format', left(coalesce(m ->> 'format', ''), 40),
          'caption', left(coalesce(m ->> 'caption', ''), 5000),
          'slides', v_slides
        );
        v_media := v_media || jsonb_build_array(v_post);
      end loop;
    end if;

    insert into public.crm_approval_items (link_id, team_id, content_id, position, content_version, content_hash, set_hash,
      title, format, channel, editorial_date, scheduled_time, script, media)
    values (p_link, p_team, cur.id, pos, cur.version, cur.content_hash, left(coalesce(it ->> 'setHash', ''), 128),
      cur.title, cur.format, cur.channel, cur.editorial_date, cur.scheduled_time, cur.script, v_media);

    update public.crm_contents set client_status = 'enviado', client_at = now() where id = cur.id;
    pos := pos + 1;
  end loop;
  return p_link;
end
$$;

revoke all on function public.crm_approval_create(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.crm_approval_create(uuid, uuid, text, text, jsonb) to authenticated;

create or replace function public.crm_approval_revoke(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  select team_id into tid from public.crm_approval_links where id = p_link;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(tid, true);
  update public.crm_approval_links set revoked_at = coalesce(revoked_at, now()) where id = p_link;
end
$$;

revoke all on function public.crm_approval_revoke(uuid) from public, anon;
grant execute on function public.crm_approval_revoke(uuid) to authenticated;

-- Comentário da equipe. Visível ao cliente (vai para o envio mais recente do conteúdo) ou interno.
create or replace function public.crm_content_comment(p_content uuid, p_body text, p_internal boolean, p_post integer, p_slide integer)
returns public.crm_content_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  me uuid;
  v_item uuid;
  res public.crm_content_comments;
begin
  select team_id into tid from public.crm_contents where id = p_content;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_v2_require(tid, false);
  if coalesce(length(btrim(p_body)), 0) not between 1 and 4000 then
    raise exception 'campo_invalido:comentario';
  end if;
  select id into v_item from public.crm_approval_items where content_id = p_content order by created_at desc limit 1;
  insert into public.crm_content_comments (team_id, content_id, item_id, author_id, author_name, internal, post, slide, body)
  values (tid, p_content, v_item, me, public.crm_person_name(me), coalesce(p_internal, false), p_post, p_slide, btrim(p_body))
  returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_comment(uuid, text, boolean, integer, integer) from public, anon;
grant execute on function public.crm_content_comment(uuid, text, boolean, integer, integer) to authenticated;

create or replace function public.crm_content_comment_resolve(p_comment uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  me uuid;
begin
  select team_id into tid from public.crm_content_comments where id = p_comment;
  if tid is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_v2_require(tid, false);
  update public.crm_content_comments
     set resolved_at = case when p_resolved then coalesce(resolved_at, now()) end,
         resolved_by = case when p_resolved then me end
   where id = p_comment;
end
$$;

revoke all on function public.crm_content_comment_resolve(uuid, boolean) from public, anon;
grant execute on function public.crm_content_comment_resolve(uuid, boolean) to authenticated;

-- Apagar o próprio comentário (gestor apaga qualquer um). Comentário do cliente fica.
create or replace function public.crm_content_comment_delete(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.crm_content_comments;
  me uuid;
begin
  select * into c from public.crm_content_comments where id = p_comment;
  if c.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_v2_require(c.team_id, false);
  if c.from_client then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if c.author_id is distinct from me and not public.is_crm_manager(c.team_id) then
    raise exception 'so_gestor' using errcode = '42501';
  end if;
  delete from public.crm_content_comments where id = p_comment;
end
$$;

revoke all on function public.crm_content_comment_delete(uuid) from public, anon;
grant execute on function public.crm_content_comment_delete(uuid) to authenticated;

-- ---------- página pública do cliente ----------

-- O envio ativo: itens, decisões e a conversa visível ao cliente. Inativo devolve só o estado.
create or replace function public.crm_approval_get(p_link uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.crm_approval_links;
  v_state text;
begin
  select * into l from public.crm_approval_links where id = p_link;
  if l.id is null then
    return jsonb_build_object('state', 'inexistente');
  end if;
  v_state := case
    when l.revoked_at is not null then 'revogado'
    when l.expires_at < now() then 'expirado'
    when not public.crm_module_on(l.team_id, 'copy') then 'revogado'
    else 'ativo' end;
  if v_state <> 'ativo' then
    return jsonb_build_object('state', v_state, 'team_name', l.team_name, 'title', l.title);
  end if;
  return jsonb_build_object(
    'state', 'ativo',
    'id', l.id,
    'title', l.title,
    'team_name', l.team_name,
    'message', l.message,
    'created_at', l.created_at,
    'expires_at', l.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'format', i.format,
        'channel', i.channel,
        'date', i.editorial_date,
        'time', to_char(i.scheduled_time, 'HH24:MI'),
        'script', i.script,
        'media', i.media,
        'decision', i.decision,
        'decided_name', i.decided_name,
        'decided_at', i.decided_at,
        -- Uma versão mais nova deste conteúdo já foi enviada em outro link
        'replaced', exists (select 1 from public.crm_approval_items n where n.content_id = i.content_id and n.created_at > i.created_at),
        'comments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.author_name, 'client', c.from_client, 'post', c.post, 'slide', c.slide,
            'body', c.body, 'created_at', c.created_at, 'resolved', c.resolved_at is not null
          ) order by c.created_at)
          from public.crm_content_comments c
          where c.item_id = i.id and not c.internal
        ), '[]'::jsonb)
      ) order by i.position)
      from public.crm_approval_items i
      where i.link_id = l.id
    ), '[]'::jsonb)
  );
end
$$;

-- Freio contra envio em massa num link público
create or replace function public.crm_approval_guard(p_link uuid)
returns public.crm_approval_links
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.crm_approval_links;
  n integer;
begin
  select * into l from public.crm_approval_links where id = p_link;
  if l.id is null or l.revoked_at is not null or l.expires_at < now() or not public.crm_module_on(l.team_id, 'copy') then
    raise exception 'link_inativo';
  end if;
  select count(*) into n from public.crm_content_comments c join public.crm_approval_items i on i.id = c.item_id
   where i.link_id = p_link and c.from_client;
  if n >= 500 then
    raise exception 'limite_respostas';
  end if;
  return l;
end
$$;

revoke all on function public.crm_approval_guard(uuid) from public, anon, authenticated;

-- Aprovar ou pedir ajuste numa peça. Pedir ajuste exige o que mudar.
create or replace function public.crm_approval_respond(p_link uuid, p_item uuid, p_decision text, p_name text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.crm_approval_links := public.crm_approval_guard(p_link);
  it public.crm_approval_items;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_latest uuid;
  v_hash text;
begin
  select * into it from public.crm_approval_items where id = p_item and link_id = l.id for update;
  if it.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  if p_decision not in ('aprovado', 'ajuste') then
    raise exception 'decisao_invalida';
  end if;
  if v_name = '' then
    raise exception 'nome_obrigatorio';
  end if;
  if p_decision = 'ajuste' and coalesce(btrim(p_note), '') = '' then
    raise exception 'comentario_obrigatorio';
  end if;

  update public.crm_approval_items set decision = p_decision, decided_name = v_name, decided_at = now() where id = it.id;
  if coalesce(btrim(p_note), '') <> '' then
    insert into public.crm_content_comments (team_id, content_id, item_id, author_name, from_client, body)
    values (it.team_id, it.content_id, it.id, v_name, true, left(btrim(p_note), 4000));
  end if;

  -- O estado do conteúdo só segue a resposta do envio mais recente, e do mesmo texto
  select id into v_latest from public.crm_approval_items where content_id = it.content_id order by created_at desc limit 1;
  select content_hash into v_hash from public.crm_contents where id = it.content_id;
  if v_latest = it.id and v_hash = it.content_hash then
    update public.crm_contents set client_status = p_decision, client_at = now() where id = it.content_id;
  end if;
  return jsonb_build_object('decision', p_decision, 'decided_at', now());
end
$$;

-- Comentário do cliente, opcionalmente sobre um post e um slide
create or replace function public.crm_approval_comment(p_link uuid, p_item uuid, p_name text, p_body text, p_post integer, p_slide integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.crm_approval_links := public.crm_approval_guard(p_link);
  it public.crm_approval_items;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  res public.crm_content_comments;
begin
  select * into it from public.crm_approval_items where id = p_item and link_id = l.id;
  if it.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  if v_name = '' then
    raise exception 'nome_obrigatorio';
  end if;
  if coalesce(length(btrim(p_body)), 0) not between 1 and 4000 then
    raise exception 'campo_invalido:comentario';
  end if;
  insert into public.crm_content_comments (team_id, content_id, item_id, author_name, from_client, post, slide, body)
  values (it.team_id, it.content_id, it.id, v_name, true,
    case when p_post between 1 and 10 then p_post end, case when p_slide between 1 and 20 then p_slide end, btrim(p_body))
  returning * into res;
  return jsonb_build_object('id', res.id, 'created_at', res.created_at);
end
$$;

revoke all on function public.crm_approval_get(uuid) from public;
revoke all on function public.crm_approval_respond(uuid, uuid, text, text, text) from public;
revoke all on function public.crm_approval_comment(uuid, uuid, text, text, integer, integer) from public;
grant execute on function public.crm_approval_get(uuid) to anon, authenticated;
grant execute on function public.crm_approval_respond(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.crm_approval_comment(uuid, uuid, text, text, integer, integer) to anon, authenticated;

-- ---------- imagens dos envios ----------
-- Bucket público (leitura só pelo endereço, sem listagem); só gestor da conta grava na pasta da conta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-aprovacao', 'crm-aprovacao', true, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function public.crm_approval_file_ok(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  head text := split_part(p_name, '/', 1);
begin
  if head !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_crm_manager(head::uuid) and public.crm_module_on(head::uuid, 'copy');
end
$$;

revoke all on function public.crm_approval_file_ok(text) from public, anon;
grant execute on function public.crm_approval_file_ok(text) to authenticated;

create policy "Gestor envia imagens da pauta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crm-aprovacao' and public.crm_approval_file_ok(name));
create policy "Gestor apaga imagens da pauta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'crm-aprovacao' and public.crm_approval_file_ok(name));

-- ---------- ao vivo ----------

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'crm_contents') then
    alter publication supabase_realtime add table public.crm_contents;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'crm_approval_items') then
    alter publication supabase_realtime add table public.crm_approval_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'crm_content_comments') then
    alter publication supabase_realtime add table public.crm_content_comments;
  end if;
end
$$;
