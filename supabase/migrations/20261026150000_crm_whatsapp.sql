-- WhatsApp da equipe (2026-10-26): ler o QR code e conectar o número
--
-- O número de WhatsApp da equipe entra no CRM como mais um aparelho
-- (WhatsApp › Aparelhos conectados), pelo nosso próprio serviço
-- (`services/whatsapp`, Node com a biblioteca Baileys), sem intermediário e
-- sem a API oficial da Meta: o número continua no celular. Foi escolha do
-- usuário, assumindo o risco de o WhatsApp restringir o número.
--
-- Por enquanto é só a conexão: o gestor pede em CRM › WhatsApp, o serviço
-- põe o QR code nesta tabela, o celular lê e o número fica conectado. O
-- navegador só lê a linha da equipe e pede conectar ou desconectar pelas
-- funções abaixo; o serviço (chave de serviço) escreve o estado e guarda as
-- chaves da sessão.

create table public.crm_whatsapp_numbers (
  team_id uuid primary key references public.crm_teams (id) on delete cascade,
  -- O gestor quer o número conectado (o serviço conecta) ou não (o serviço desconecta)
  wanted boolean not null default false,
  status text not null default 'disconnected' check (status in ('disconnected', 'connecting', 'connected')),
  -- O QR code da vez (PNG em data URL); o WhatsApp troca a cada ~20 s até o celular ler
  qr text,
  phone text,
  profile_name text,
  -- Por que caiu (o código venceu, o celular desconectou…)
  error text,
  requested_at timestamptz,
  requested_by uuid references auth.users (id) on delete set null,
  -- A última vez que o serviço passou por aqui (de 20 em 20 s com o número ligado)
  seen_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

-- As chaves da sessão (o aparelho conectado). Dão acesso ao WhatsApp inteiro:
-- RLS sem política, só o serviço lê e escreve.
create table public.crm_whatsapp_auth (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, key)
);

alter table public.crm_whatsapp_numbers enable row level security;
alter table public.crm_whatsapp_auth enable row level security;

create policy "Equipe vê o WhatsApp" on public.crm_whatsapp_numbers
  for select to authenticated using (public.is_crm_member(team_id));

-- O gestor pede a conexão: o serviço vê o pedido e põe o QR code na linha
create or replace function public.crm_whatsapp_connect(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_manager(p_team) then
    raise exception 'Só quem gerencia a equipe conecta o WhatsApp.' using errcode = '42501';
  end if;
  insert into public.crm_whatsapp_numbers as n (team_id, wanted, status, requested_at, requested_by)
  values (p_team, true, 'connecting', now(), auth.uid())
  on conflict (team_id) do update set
    wanted = true,
    status = case when n.status = 'connected' then n.status else 'connecting' end,
    error = null,
    requested_at = now(),
    requested_by = auth.uid(),
    updated_at = now();
end
$$;

-- E a desconexão: o serviço tira o aparelho do celular e apaga as chaves
create or replace function public.crm_whatsapp_disconnect(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_manager(p_team) then
    raise exception 'Só quem gerencia a equipe desconecta o WhatsApp.' using errcode = '42501';
  end if;
  update public.crm_whatsapp_numbers set wanted = false, error = null, updated_at = now() where team_id = p_team;
end
$$;

revoke all on function public.crm_whatsapp_connect(uuid) from public, anon;
revoke all on function public.crm_whatsapp_disconnect(uuid) from public, anon;
grant execute on function public.crm_whatsapp_connect(uuid) to authenticated;
grant execute on function public.crm_whatsapp_disconnect(uuid) to authenticated;

-- Ao vivo: o QR code novo e o "conectado" aparecem sem recarregar
do $$
begin
  alter publication supabase_realtime add table public.crm_whatsapp_numbers;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Sem a publicação supabase_realtime: a tela relê sozinha de tempos em tempos';
end
$$;
