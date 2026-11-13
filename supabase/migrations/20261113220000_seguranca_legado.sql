-- Segurança do esquema legado (revisão completa de 2026-11-13). Só fecha acesso: nenhuma tabela, linha ou
-- função é apagada aqui. Nada no app, nos scripts, nos serviços ou nas funções usa os objetos fechados.

-- 1. Views do esquema antigo eram do postgres sem security_invoker, então ignoravam o RLS e o anon lia
--    orçamento e custos dos projetos legados. Passam a respeitar o RLS de quem consulta, e o anon perde o acesso.
alter view public.project_cost_summary set (security_invoker = on);
alter view public.shared_connections set (security_invoker = on);
alter view public.figma_conversion_stats set (security_invoker = on);
revoke all on public.project_cost_summary, public.shared_connections, public.figma_conversion_stats from anon;

-- 2. Propostas legadas: qualquer pessoa listava todas (nome, e-mail, preço e o token que aceita ou recusa)
drop policy if exists public_select_proposal_by_token on public.proposals;
revoke execute on function public.public_set_proposal_status_by_token(text, text) from public, anon;

-- 3. Webhook de pagamento antigo (Asaas): o anon inseria linhas à vontade e podia chamar a função que dá o papel pro
drop policy if exists "Service role can insert webhooks" on public.asaas_webhooks;
revoke execute on function public.process_payment_webhook(text, text) from public, anon, authenticated;
alter function public.process_payment_webhook(text, text) set search_path = public;

-- 4. space_log grava no registro de atividades sem conferir acesso ao projeto; quem chama de fora usa
--    space_log_event (que confere). Os gatilhos que usam space_log são SECURITY DEFINER do postgres e seguem iguais.
revoke execute on function public.space_log(uuid, text, text, jsonb, text, uuid) from public, anon, authenticated;

-- 5. Equipe: o gestor muda só o papel. Antes a permissão de UPDATE cobria user_id e team_id, e dava para trocar
--    o dono da linha do dono da conta. A tela só muda `role` (src/features/crm/teams.ts).
revoke update on public.crm_team_members from authenticated;
grant update (role) on public.crm_team_members to authenticated;
