-- Quadros pelo MCP (2026-11-12): o servidor não monta elementos do Excalidraw (a medida do texto e
-- os ícones são do navegador). O MCP grava o bloco pedido (o mesmo BoardDraft da Iara) em `pending`;
-- o editor do quadro, ao abrir ou voltar à aba, pega a fila com `crm_board_take_pending` e desenha
-- embaixo do que já existe. `pending` não muda a `rev` (o gatilho só olha `scene`).

alter table public.crm_boards add column if not exists pending jsonb not null default '[]'::jsonb;

alter table public.crm_boards drop constraint if exists crm_boards_pending_shape;
alter table public.crm_boards add constraint crm_boards_pending_shape
  check (jsonb_typeof(pending) = 'array' and jsonb_array_length(pending) <= 20 and pg_column_size(pending) <= 200000);

-- Esvazia a fila e devolve o que estava nela (com as políticas de quem chama).
create or replace function public.crm_board_take_pending(p_board uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pending jsonb;
begin
  select pending into v_pending from public.crm_boards where id = p_board for update;
  if v_pending is null or jsonb_array_length(v_pending) = 0 then
    return '[]'::jsonb;
  end if;
  update public.crm_boards set pending = '[]'::jsonb where id = p_board;
  return v_pending;
end;
$$;

revoke all on function public.crm_board_take_pending(uuid) from public;
grant execute on function public.crm_board_take_pending(uuid) to authenticated;
