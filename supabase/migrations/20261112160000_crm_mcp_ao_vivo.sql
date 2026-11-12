-- A IA conectada (MCP) ao vivo nas telas (2026-11-12, o usuário: "quero ver alterando o sistema em tempo real,
-- ter que atualizar página não é bom, podemos usar os cursores?"). A função sinfy-mcp manda, a cada ferramenta
-- que muda algo, um aviso (broadcast do Realtime, sem conteúdo: ferramenta, onde e quem) no canal privado
-- `mcp:<conta>`. Só quem é da conta ouve; ninguém fala nele pelo navegador (o servidor usa a chave de serviço).

create or replace function public.can_join_crm_mcp_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_topic !~ '^mcp:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_crm_member(substring(p_topic from 5)::uuid);
end
$$;

revoke all on function public.can_join_crm_mcp_topic(text) from public;
grant execute on function public.can_join_crm_mcp_topic(text) to authenticated;

do $$
begin
  drop policy if exists "Equipe ouve a IA conectada" on realtime.messages;
  create policy "Equipe ouve a IA conectada" on realtime.messages
    for select to authenticated
    using (realtime.messages.extension = 'broadcast' and public.can_join_crm_mcp_topic((select realtime.topic())));
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'Realtime sem autorização neste projeto: a IA conectada fica sem o ao vivo';
end
$$;
