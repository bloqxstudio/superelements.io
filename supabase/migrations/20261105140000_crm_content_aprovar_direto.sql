-- Aprovação em um clique (2026-11-05). O usuário: "nao consegui aprovar… quero que isso seja mais
-- simples". O gestor passa a aprovar direto de "em produção" (antes era preciso enviar para
-- revisão e depois aprovar). Continua exigindo roteiro e gravando o registro da aprovação.

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
    ('revisao', 'producao'), ('revisao', 'aprovado'), ('aprovado', 'producao'),
    -- Pauta (2026-11-05): o gestor aprova direto da produção, sem a volta pela revisão
    ('producao', 'aprovado')
  )) then
    raise exception 'transicao_invalida';
  end if;
  if p_to in ('revisao', 'aprovado') and length(btrim(cur.script)) = 0 then
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
