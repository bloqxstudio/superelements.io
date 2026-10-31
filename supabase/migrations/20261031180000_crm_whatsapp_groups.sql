-- Grupos de WhatsApp em que o número da equipe está (2026-10-31)
--
-- O serviço do WhatsApp lista os grupos do número ligado (`crm_whatsapp_groups`, só ele escreve
-- nome e tamanho). O admin da plataforma escolhe, por grupo, de qual conta ele recebe os avisos de
-- lead novo (`leads_account_id`). O grupo não vira conversa na caixa de entrada: o aviso sai direto
-- pelo serviço e continua saindo uma única vez (`crm_claim_lead_alert`).

create table public.crm_whatsapp_groups (
  -- A conta dona do número do WhatsApp (a da Avence)
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  jid text not null check (jid like '%@g.us'),
  name text not null default '',
  size integer not null default 0,
  -- Conta cujos leads novos chegam neste grupo (vazio = nenhuma)
  leads_account_id uuid references public.crm_teams (id) on delete set null,
  seen_at timestamptz not null default now(),
  primary key (team_id, jid)
);

alter table public.crm_whatsapp_groups enable row level security;

create policy "Gestor vê os grupos do WhatsApp" on public.crm_whatsapp_groups
  for select to authenticated using (public.is_crm_manager(team_id) or public.crm_is_platform_admin());
create policy "Admin da plataforma escolhe o grupo dos leads" on public.crm_whatsapp_groups
  for update to authenticated using (public.crm_is_platform_admin()) with check (public.crm_is_platform_admin());

-- Só o destino pode ser mudado por quem está logado; nome, tamanho e jid são do serviço
revoke update on table public.crm_whatsapp_groups from authenticated;
grant update (leads_account_id) on table public.crm_whatsapp_groups to authenticated;
