-- Fotos para a IA conectada (MCP) sem passar pelo chat (2026-11-12, o usuário: "mcp não permitiu enviar
-- uma imagem para o post… quero que grave as imagens dentro do nosso banco do cliente, no cérebro").
-- O ChatGPT e o Claude não repassam ao servidor MCP a imagem anexada na conversa. A IA gera um link de
-- envio (`sinfy_link_envio`): a pessoa abre /enviar/<token> no app, escolhe as fotos e elas vão para o
-- Cérebro da conta (`crm/<conta>/cerebro/<pasta>/`). Guardamos só o hash do token; vale 2 horas e até 20
-- arquivos. Só a função sinfy-mcp (service_role) lê e grava.

create table if not exists public.crm_mcp_uploads (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key_id uuid references public.crm_mcp_keys(id) on delete set null,
  folder text not null default 'fotos/enviadas',
  files text[] not null default '{}',
  max_files integer not null default 20,
  expires_at timestamptz not null default now() + interval '2 hours',
  created_at timestamptz not null default now(),
  constraint crm_mcp_uploads_folder check (folder ~ '^[A-Za-z0-9À-ÿ _().,&+-]+(/[A-Za-z0-9À-ÿ _().,&+-]+)*$' and folder !~ '(^|/)\.' and folder !~ '^plataforma(/|$)' and length(folder) <= 200)
);

create index if not exists crm_mcp_uploads_team_idx on public.crm_mcp_uploads (team_id, created_at desc);

alter table public.crm_mcp_uploads enable row level security;
revoke all on public.crm_mcp_uploads from public, anon, authenticated;
grant select, insert, update, delete on public.crm_mcp_uploads to service_role;

-- O motivo quando uma ferramenta falha (para entender o que a IA tentou)
alter table public.crm_mcp_log add column if not exists error text;
