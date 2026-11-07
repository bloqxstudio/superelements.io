# Sinfy

> O produto focado em resultados: mostra o caminho anúncio → site → lead → conversa → venda, e produz o conteúdo.

**Estado:** em construção (conta própria e piloto com um cliente)
**Atualizado em:** 2026-11-06

## Por que existe

Quem anuncia não vê o que o anúncio virou. A Sinfy junta anúncios da Meta, visitas do site, formulários,
leads e conversas numa conta, e cria o conteúdo na marca da empresa.

## O que já existe

- Produto `resultados` no app, com menu próprio: Visão geral, O caminho (Anúncios, Site, Leads, Formulários, Conversas), Conteúdo (Plano, Conteúdos, Criativos, Instagram, Textos), Conta.
- Landing `/lp` e a mesma LP no Space (projeto "Sinfy", 9 seções nativas, não publicada).
- Conta "Sinfy" com marca própria (`brands/sinfy/DESIGN.md`) e série de lançamento: 10 publicações e 4 stories, com vídeos.
- Criativos sempre na marca da conta (correção de 2026-11-03: não misturar com a Avence).
- MCP da Sinfy: qualquer IA (Claude, ChatGPT, Cursor) conectada à conta, com chave pessoal. Não testado com chave real.
- Formulários com capa, agenda, pixel da Meta e funil ao vivo; Pauta com aprovação do cliente por link.

## Em andamento

- Piloto com um cliente (jornada completa e criativos em volume). O detalhe fica na pasta do cliente, vista com a conta dele aberta.

## Próximos passos

1. Visão geral do caminho anúncio → venda.
2. Conexões, Relatórios e Carteira da agência.
3. Leads e Conversas unificando as telas atuais.
4. Revisar a FAQ da `/lp`, que ainda diz que a Sinfy "não cria criativos".

## Bloqueios e riscos

- **App da Meta publicado** (verificação da empresa e App Review): sem ele só contas testadoras conectam o Instagram. Ver [META-PRODUCAO.md](../../../META-PRODUCAO.md).
- **Decisão do WhatsApp** para vender a terceiros (hoje é conexão não oficial).

## Links

- Código: `src/features/crm/modules.ts` (`PRODUCTS`), `src/components/AppSidebar.tsx` (`ResultsNav`), `src/features/sinfy/`
- Decisões: [decisoes.md](decisoes.md) · Log: [log/](log)
