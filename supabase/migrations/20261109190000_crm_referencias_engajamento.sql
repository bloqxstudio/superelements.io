-- Referências: o engajamento do post e a ordem em que foi mandado no grupo (2026-11-09).
--
-- O usuário: "podemos ter o engajamento daquele vídeo? pra conseguir usar isso como um argumento e análise"
-- e "mostre a ordem enviada no grupo, mais recente em cima".
--
-- likes, comments e views são os números que a página do post mostrava quando o Mac leu (metrics_at), não
-- um acompanhamento contínuo. group_order guarda a posição no grupo: maior = mandado mais recentemente
-- (a tela ordena por ele, e por created_at nas referências salvas à mão).

alter table public.crm_references add column if not exists likes integer check (likes is null or likes >= 0);
alter table public.crm_references add column if not exists comments integer check (comments is null or comments >= 0);
alter table public.crm_references add column if not exists views integer check (views is null or views >= 0);
alter table public.crm_references add column if not exists metrics_at timestamptz;
alter table public.crm_references add column if not exists group_order bigint;

create index if not exists crm_references_source_order_idx on public.crm_references (source_id, group_order desc);
