-- Integração real de Plano/Conteúdos. Fixtures fictícios, sempre revertidos.
-- Execute depois da migração com npm run db:query -- --file scripts/tests/superelements-v2.database.sql
begin;
create temporary table v2_fixture as select gen_random_uuid() as owner_id, gen_random_uuid() as seller_id,
  gen_random_uuid() as outsider_id, gen_random_uuid() as team_id, gen_random_uuid() as other_team_id,
  gen_random_uuid() as disabled_team_id, gen_random_uuid() as paused_team_id;
grant select on v2_fixture to authenticated;
insert into auth.users(id, email, raw_user_meta_data)
select owner_id, owner_id::text || '@v2-test.invalid', '{"full_name":"V2 Test"}'::jsonb from v2_fixture
union all select seller_id, seller_id::text || '@v2-test.invalid', '{"full_name":"V2 Test"}'::jsonb from v2_fixture
union all select outsider_id, outsider_id::text || '@v2-test.invalid', '{"full_name":"V2 Test"}'::jsonb from v2_fixture;
insert into public.crm_teams(id,name,status,modules)
select team_id,'V2 Test Active','ativa','{}'::jsonb from v2_fixture
union all select other_team_id,'V2 Test Other','ativa','{}'::jsonb from v2_fixture
union all select disabled_team_id,'V2 Test Disabled','ativa','{"copy":false}'::jsonb from v2_fixture
union all select paused_team_id,'V2 Test Paused','pausada','{}'::jsonb from v2_fixture;
insert into public.crm_team_members(team_id,user_id,role)
select team_id,owner_id,'admin' from v2_fixture
union all select team_id,seller_id,'seller' from v2_fixture
union all select other_team_id,outsider_id,'owner' from v2_fixture
union all select disabled_team_id,owner_id,'admin' from v2_fixture
union all select paused_team_id,owner_id,'admin' from v2_fixture;
select set_config('request.jwt.claim.sub',(select owner_id::text from v2_fixture),true);
set local role authenticated;
do $$
declare
  f record;
  ctx public.crm_account_context;
  c public.crm_contents;
  prior integer;
  blocked boolean;
begin
  select * into f from v2_fixture;
  ctx := public.crm_context_save(f.team_id,0,'{"offer":"Oferta teste","audience":"Público teste","pillars":["Educar"]}');
  if ctx.version <> 1 then raise exception 'QA: contexto inicial'; end if;
  ctx := public.crm_context_save(f.team_id,1,'{"offer":"Nova oferta","pillars":[]}');
  if ctx.version <> 2 then raise exception 'QA: contexto versionado'; end if;
  blocked := false;
  begin perform public.crm_context_save(f.team_id,1,'{}');
  exception when raise_exception then blocked := sqlerrm = 'conflito_de_versao'; end;
  if not blocked then raise exception 'QA: contexto stale permitido'; end if;
  c := public.crm_content_create(f.team_id,'{"title":"Teste de conteúdo","script":"Roteiro inicial"}');
  c := public.crm_content_transition(c.id,c.version,'producao');
  c := public.crm_content_transition(c.id,c.version,'revisao');
  c := public.crm_content_transition(c.id,c.version,'aprovado');
  if c.approved_version <> c.version or c.approved_hash <> c.content_hash then raise exception 'QA: aprovação sem versão'; end if;
  if (select count(*) from public.crm_content_snapshots where content_id=c.id) <> 2 then raise exception 'QA: snapshots'; end if;
  prior := c.version;
  c := public.crm_content_save(c.id,c.version,'{"script":"Roteiro alterado"}');
  if c.status <> 'producao' or c.approved_version is not null then raise exception 'QA: aprovação stale'; end if;
  blocked := false;
  begin perform public.crm_content_save(c.id,prior,'{"title":"Edição concorrente"}');
  exception when raise_exception then blocked := sqlerrm = 'conflito_de_versao'; end;
  if not blocked then raise exception 'QA: edição stale permitida'; end if;
  blocked := false;
  begin update public.crm_contents set status='aprovado' where id=c.id;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: update direto permitido'; end if;
  blocked := false;
  begin perform public.crm_content_create(f.other_team_id,'{"title":"Cross tenant"}');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: escrita de outra conta'; end if;
  blocked := false;
  begin perform public.crm_content_create(f.disabled_team_id,'{"title":"Disabled"}');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: módulo desligado'; end if;
  blocked := false;
  begin perform public.crm_context_save(f.paused_team_id,0,'{}');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: conta pausada'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select seller_id::text from v2_fixture),true);
do $$
declare f record; c public.crm_contents; blocked boolean;
begin
  select * into f from v2_fixture;
  c := public.crm_content_create(f.team_id,'{"title":"Seller test","script":"Texto"}');
  c := public.crm_content_transition(c.id,c.version,'producao');
  c := public.crm_content_transition(c.id,c.version,'revisao');
  blocked := false;
  begin perform public.crm_content_transition(c.id,c.version,'aprovado');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: seller aprovou'; end if;
  blocked := false;
  begin perform public.crm_context_save(f.team_id,2,'{}');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: seller editou contexto'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select outsider_id::text from v2_fixture),true);
do $$
begin
  if exists(select 1 from public.crm_contents where team_id=(select team_id from v2_fixture)) then
    raise exception 'QA: leitura de outra conta';
  end if;
  if exists(select 1 from public.crm_account_context where team_id=(select team_id from v2_fixture)) then
    raise exception 'QA: contexto de outra conta';
  end if;
end $$;
reset role;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform public.crm_content_create('00000000-0000-0000-0000-000000000000','{"title":"Anon"}');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: RPC anônimo permitido'; end if;
  blocked := false;
  begin perform count(*) from public.crm_contents;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: leitura anônima permitida'; end if;
end $$;
reset role;
-- O histórico não aceita alteração direta, mas também não pode bloquear a remoção de um usuário.
do $$
declare blocked boolean := false;
begin
  begin update public.crm_content_snapshots set payload='{}' where team_id=(select team_id from v2_fixture);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'QA: snapshot alterável'; end if;
end $$;
delete from auth.users where id=(select owner_id from v2_fixture);
do $$
begin
  if (select count(*) from public.crm_content_snapshots where team_id=(select team_id from v2_fixture)) <> 3 then
    raise exception 'QA: perda de snapshots ao remover usuário';
  end if;
end $$;

rollback; select 'V2 database behavioral checks passed; rolled back' as result;
