# Geral: a empresa

**Atualizado em:** 2026-11-06

## As marcas (nunca misturar)

| Marca | O que é | Para quem |
| --- | --- | --- |
| **Avence Studio** | O estúdio. Vende serviço: site novo com preço único e plano mensal opcional. São Leopoldo (RS), @avencestudio. | Donos de negócios locais que já anunciam. |
| **SuperElements** | O produto construtor (Space, Elementor, agentes, Criativos, Motion). Nunca aparece para o cliente final do estúdio. | Agências e quem faz sites. |
| **Sinfy** | O produto de resultados: anúncios, site, leads, formulários, conversas e conteúdo. Landing em `/lp`. | Empresas e agências que querem ver o caminho anúncio → venda. |

Decisões de origem: duas marcas separadas, Avence e SuperElements (2026-10-04); a plataforma separada em
produtos, Completo, Sinfy e SuperElements (2026-11-02). Ver [decisoes.md](decisoes.md).

## Produtos dentro do app

Cada conta tem um produto (`crm_teams.product`): `completo` (tudo; a Avence e as contas antigas),
`resultados` = Sinfy, `builder` = SuperElements. O produto decide o menu e os módulos ligados.

## Infraestrutura (resumo)

- Código: GitHub `bloqxstudio/superelements.io`; app em `app.avencestudio.com` (Hostinger, deploy da `main`).
- Banco e funções: Supabase `nfmfcpcwyavutntnrxqq`. Como operar: [OPERACAO.md](../../OPERACAO.md).
- WhatsApp: serviço próprio (Baileys) num MacBook que fica ligado.
- IA: roda nesta máquina pelo conector (Claude Code e Codex), sem custo de API.

## Onde está o detalhe

- Técnico, por funcionalidade: [AGENTS.md](../../AGENTS.md).
- Marcas e textos de cada cliente: `brands/<cliente>/DESIGN.md` e `COPY.md`.
- Meta (publicação do app): [META-PRODUCAO.md](../../META-PRODUCAO.md).
