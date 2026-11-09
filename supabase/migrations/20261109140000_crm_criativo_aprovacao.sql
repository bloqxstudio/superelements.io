-- Aprovação de um criativo pelo cliente, com a simulação do Instagram (2026-11-09).
--
-- O usuário: "uma forma de aprovar o criativo, vamos enviar um link para o cliente aprovar do criativo,
-- podendo ser estático, carrossel, vídeo ou motion. O cliente vai abrir e visualizar como vai ficar no
-- Instagram dele simuladamente e aprovar por esse link, ou colocar algum ajuste que queira."
--
-- Reaproveita o envio da Pauta (crm_approval_links / crm_approval_items / crm_content_comments e a
-- página pública /pauta/aprovar/:id). Um item passa a poder ser um criativo solto (`kind = 'criativo'`,
-- com o conjunto e o post), sem conteúdo da Pauta. O bucket aceita MP4 (vídeo e motion). A página
-- desenha o item como no Instagram: feed, carrossel, Reels ou story (`media[].view`).
-- Quem cria o envio de criativo é qualquer pessoa da equipe (o designer manda para o cliente); o envio
-- da Pauta continua só do gestor.

-- ---------- itens e comentários sem conteúdo ----------

alter table public.crm_approval_items alter column content_id drop not null;
alter table public.crm_approval_items add column if not exists kind text not null default 'conteudo';
alter table public.crm_approval_items add column if not exists set_id text;
alter table public.crm_approval_items add column if not exists post_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_approval_items_kind_check') then
    alter table public.crm_approval_items add constraint crm_approval_items_kind_check check (
      (kind = 'conteudo' and content_id is not null)
      or (kind = 'criativo' and set_id ~ '^[A-Za-z0-9_-]{1,80}$' and post_id ~ '^[A-Za-z0-9_-]{1,80}$')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_approval_items_link_post_key') then
    alter table public.crm_approval_items add constraint crm_approval_items_link_post_key unique (link_id, set_id, post_id);
  end if;
end $$;

create index if not exists crm_approval_items_post_idx on public.crm_approval_items (set_id, post_id, created_at desc) where kind = 'criativo';

alter table public.crm_content_comments alter column content_id drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_content_comments_target_check') then
    alter table public.crm_content_comments add constraint crm_content_comments_target_check check (content_id is not null or item_id is not null);
  end if;
end $$;

-- O perfil do Instagram que a simulação mostra (o @ da conta na hora do envio)
alter table public.crm_approval_links add column if not exists ig_username text check (ig_username is null or ig_username ~ '^[A-Za-z0-9._]{1,30}$');

-- ---------- bucket: vídeo ----------

update storage.buckets
   set file_size_limit = 104857600,
       allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4']
 where id = 'crm-aprovacao';

-- Quem grava na pasta da conta: o gestor (Pauta) e, para criativos, qualquer pessoa da equipe com o
-- módulo de criativos ou de conteúdo ligado
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
  return public.is_crm_member(head::uuid)
     and (public.crm_module_on(head::uuid, 'copy') or public.crm_module_on(head::uuid, 'criativos'));
end
$$;

-- O link vale se a conta tem conteúdo ou criativos ligados
create or replace function public.crm_approval_on(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_module_on(p_team, 'copy') or public.crm_module_on(p_team, 'criativos')
$$;
revoke all on function public.crm_approval_on(uuid) from public, anon, authenticated;

-- Pessoa da equipe, com conteúdo ou criativos ligados (crm_v2_require exige o módulo de conteúdo)
create or replace function public.crm_creative_require(p_team uuid)
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
  if not public.crm_approval_on(p_team) then
    raise exception 'modulo_desligado' using errcode = '42501';
  end if;
  return me;
end
$$;
revoke all on function public.crm_creative_require(uuid) from public, anon, authenticated;

-- ---------- criar o envio de um criativo ----------
-- p_items: [{ "itemId", "setId", "postId", "setHash", "title", "format",
--             "media": [{ "name", "format", "caption", "view", "slides": [caminhos], "poster" }] }]
-- view: feed | carrossel | reels | story. Slides: imagens (jpg/png) ou vídeos (mp4); poster: a capa do vídeo.
create or replace function public.crm_creative_approval_create(p_team uuid, p_link uuid, p_title text, p_message text, p_ig text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.crm_creative_require(p_team);
  v_team text;
  it jsonb;
  m jsonb;
  s jsonb;
  pos integer := 0;
  v_item uuid;
  v_media jsonb;
  v_slides jsonb;
  v_poster text;
  v_view text;
  prefix text;
  file_re text := '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(jpg|png|mp4)$';
begin
  if p_link is null then
    raise exception 'campo_invalido:envio';
  end if;
  if coalesce(length(btrim(p_title)), 0) not between 1 and 120 then
    raise exception 'campo_invalido:titulo';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'campo_invalido:itens';
  end if;
  if p_ig is not null and btrim(p_ig) <> '' and btrim(p_ig) !~ '^@?[A-Za-z0-9._]{1,30}$' then
    raise exception 'campo_invalido:instagram';
  end if;
  select name into v_team from public.crm_teams where id = p_team;

  insert into public.crm_approval_links (id, team_id, title, team_name, message, created_by, ig_username)
  values (p_link, p_team, btrim(p_title), left(coalesce(v_team, ''), 160), left(coalesce(btrim(p_message), ''), 1000), me,
    nullif(ltrim(btrim(coalesce(p_ig, '')), '@'), ''));

  for it in select value from jsonb_array_elements(p_items) loop
    v_item := nullif(it ->> 'itemId', '')::uuid;
    if v_item is null then
      raise exception 'campo_invalido:item';
    end if;
    prefix := p_team::text || '/' || p_link::text || '/' || v_item::text || '/';
    if jsonb_typeof(it -> 'media') <> 'array' or jsonb_array_length(it -> 'media') not between 1 and 10 then
      raise exception 'campo_invalido:media';
    end if;
    v_media := '[]'::jsonb;
    for m in select value from jsonb_array_elements(it -> 'media') loop
      if jsonb_typeof(m -> 'slides') <> 'array' or jsonb_array_length(m -> 'slides') not between 1 and 20 then
        raise exception 'campo_invalido:slides';
      end if;
      v_slides := '[]'::jsonb;
      for s in select value from jsonb_array_elements(m -> 'slides') loop
        if jsonb_typeof(s) <> 'string' or left(s #>> '{}', length(prefix)) <> prefix or (s #>> '{}') !~ file_re then
          raise exception 'campo_invalido:arquivo';
        end if;
        v_slides := v_slides || jsonb_build_array(s);
      end loop;
      v_poster := nullif(m ->> 'poster', '');
      if v_poster is not null and (left(v_poster, length(prefix)) <> prefix or v_poster !~ file_re or v_poster ~ '\.mp4$') then
        raise exception 'campo_invalido:capa';
      end if;
      v_view := coalesce(m ->> 'view', 'feed');
      if v_view not in ('feed', 'carrossel', 'reels', 'story') then
        raise exception 'campo_invalido:vista';
      end if;
      v_media := v_media || jsonb_build_array(jsonb_build_object(
        'name', left(coalesce(m ->> 'name', ''), 120),
        'format', left(coalesce(m ->> 'format', ''), 40),
        'caption', left(coalesce(m ->> 'caption', ''), 5000),
        'view', v_view,
        'slides', v_slides,
        'poster', v_poster
      ));
    end loop;

    insert into public.crm_approval_items (id, link_id, team_id, content_id, kind, set_id, post_id, position, content_version, content_hash, set_hash,
      title, format, script, media)
    values (v_item, p_link, p_team, null, 'criativo', left(coalesce(it ->> 'setId', ''), 80), left(coalesce(it ->> 'postId', ''), 80), pos, 0, '',
      left(coalesce(it ->> 'setHash', ''), 128), left(coalesce(nullif(btrim(it ->> 'title'), ''), btrim(p_title)), 160),
      left(coalesce(it ->> 'format', ''), 40), '', v_media);
    pos := pos + 1;
  end loop;
  return p_link;
end
$$;

revoke all on function public.crm_creative_approval_create(uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.crm_creative_approval_create(uuid, uuid, text, text, text, jsonb) to authenticated;

-- ---------- página pública: criativos e o @ ----------

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
    when not public.crm_approval_on(l.team_id) then 'revogado'
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
    'ig_username', l.ig_username,
    'created_at', l.created_at,
    'expires_at', l.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'kind', i.kind,
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
        -- Uma versão mais nova desta peça já foi enviada em outro link
        'replaced', case when i.kind = 'criativo'
          then exists (select 1 from public.crm_approval_items n where n.kind = 'criativo' and n.set_id = i.set_id and n.post_id = i.post_id and n.team_id = i.team_id and n.created_at > i.created_at)
          else exists (select 1 from public.crm_approval_items n where n.content_id = i.content_id and n.created_at > i.created_at) end,
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
  if l.id is null or l.revoked_at is not null or l.expires_at < now() or not public.crm_approval_on(l.team_id) then
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

-- Comentário da equipe numa peça de criativo (visível ao cliente ou interno), pelo item do envio
create or replace function public.crm_creative_item_comment(p_item uuid, p_body text, p_internal boolean)
returns public.crm_content_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.crm_approval_items;
  me uuid;
  res public.crm_content_comments;
begin
  select * into it from public.crm_approval_items where id = p_item;
  if it.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  me := public.crm_creative_require(it.team_id);
  if coalesce(length(btrim(p_body)), 0) not between 1 and 4000 then
    raise exception 'campo_invalido:comentario';
  end if;
  insert into public.crm_content_comments (team_id, content_id, item_id, author_id, author_name, internal, body)
  values (it.team_id, it.content_id, it.id, me, public.crm_person_name(me), coalesce(p_internal, false), btrim(p_body))
  returning * into res;
  return res;
end
$$;

revoke all on function public.crm_creative_item_comment(uuid, text, boolean) from public, anon;
grant execute on function public.crm_creative_item_comment(uuid, text, boolean) to authenticated;
