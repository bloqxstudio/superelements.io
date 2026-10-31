# Superelements v2 — primeiro incremento (2026-10-31)

Plano da empresa, Conteúdos, aprovação por versão e pendências no Início. O produto continua
Superelements; nada aqui copia a marca ou a interface de outro produto.

Migração: `supabase/migrations/20261031041728_superelements_v2_plano_conteudos.sql` (nova, não
editou nenhuma antiga). **Ainda não foi aplicada** nem publicada: segue o fluxo de `OPERACAO.md`
(`npm run db:plan`, `npm run db:migrate`). Sem ela, as telas dizem que falta a migração.

## O que existe

| Tela | Rota | Quem |
| --- | --- | --- |
| Plano da empresa | `/plano` | membros leem; dono e gestor editam |
| Conteúdos (lista e quadro) | `/conteudos` (`?estado=`, `?visao=quadro`, `?novo=1`) | membros criam e editam |
| Detalhe do conteúdo | `/conteudos/:id` | membros editam e submetem; **só dono e gestor aprovam** |
| Card "Plano e conteúdos" | Início | pendências reais, cada uma abre a tela certa |

Menu: "Plano" e "Conteúdos" em Produção, para quem é de uma conta e com o módulo **Copy** ligado.

## Regras (todas no servidor)

- **Plano**: oferta, público, tom, objetivo, pilares (até 8) e restrições. Um registro por conta, com
  `version`. `crm_context_save(team, versão_esperada, dados)`: `0` cria; outra versão que não a
  atual recusa com `conflito_de_versao` (a tela avisa e não sobrescreve). Cada versão fica em
  `crm_account_context_versions` (imutável). O cadastro da conta (segmento, site) só aparece como
  consulta; nada é copiado nem inventado.
- **Conteúdo**: `ideia → produção → revisão → aprovado`; revisão volta a produção (pedir ajustes) e
  aprovado volta a produção (reabrir). Revisão exige roteiro. Toda mudança exige a versão que a
  pessoa viu. Ninguém grava nas tabelas direto: não há política de escrita, só as funções
  `crm_content_*` (security definer, `search_path` fixo, `auth.uid()`, conta, módulo e papel).
- **Aprovação**: `crm_content_transition(..., 'aprovado')`, só dono/gestor, só vinda de "em revisão",
  grava um snapshot imutável (texto, versão exata, contexto do plano com a versão que valia, quem
  aprovou). Uma restrição do banco (`crm_contents_approval_ck`) impede "aprovado" com hash diferente
  do atual. **Editar o texto de um conteúdo aprovado derruba a aprovação** (volta a "em produção").
  A data editorial não entra no hash.
- **Escopo**: toda tabela tem `team_id`; vínculo e snapshot usam chave composta `(content_id, team_id)`.
  Leitura exige membro **e** módulo `copy` ligado **e** conta ativa; as funções conferem o mesmo.

## O que a aprovação cobre — e o que não cobre

Cobre **só o texto** do conteúdo: título, formato, objetivo, ideia e roteiro, na versão aprovada.
**Não cobre** o design dos Criativos nem links externos. A tela diz isso ao lado do botão. O servidor
não tem snapshot confiável do material do Copy e dos Criativos, porque eles vivem no Storage.

## Copy e Criativos

"Encaminhar para Copy/Criativos" cria um documento/conjunto **real** pelas mesmas APIs de sempre, com o
briefing do Plano (`briefOf`) e o vínculo de volta (`source.contentId`, botão "Voltar ao conteúdo" nos
dois editores). O id é derivado do conteúdo (`conteudo-<id>`), e há `unique` no banco: abrir de novo
reaproveita, nunca duplica.

- **Copy**: o roteiro vira blocos de parágrafo. Antes de aprovar, a tela lê o documento e **compara o
  texto com o roteiro**; se for diferente, bloqueia a aprovação e oferece "Trazer o texto do Copy" ou
  "Enviar o roteiro ao Copy".
- **Criativos**: nasce um conjunto com um post de partida (título, legenda = roteiro) na marca do
  projeto, ou neutro. O design muda de propósito depois, então não bloqueia a aprovação do texto; a tela
  só avisa quando o design mudou desde o vínculo.
- O hash do material guardado em `crm_content_links` é informado pelo navegador: serve para avisar, não
  como prova (os snapshots o marcam `hashSource: navegador`).

## Limites conhecidos

- **Material sem projeto fica na pasta pessoal de quem criou** (assim Copy e Criativos já funcionam).
  Outro membro vê "material indisponível". Escolha um projeto da conta em "Onde guardar ao criar" para a
  equipe abrir. O servidor confere que o projeto é da conta.
- Plano e Conteúdos usam o módulo `copy`; vincular Criativos exige também `criativos`. Não há módulo novo.
- Sem portal público e sem papel de cliente aprovador: aprovam apenas `owner`/`admin` da conta.
- Sem Realtime: a tela relê ao abrir e a edição simultânea é decidida pela versão esperada.
- Sem envio, publicação ou mensagem externa; sem campanhas automáticas.
- As regras de SQL foram conferidas por análise do arquivo em `scripts/tests/superelements-v2.test.mjs`;
  **não foram executadas contra um Postgres** (não havia banco no ambiente). Antes de publicar, rodar um
  teste real das funções (conflito de versão, aprovar como vendedor, módulo desligado, conta alheia).

## Segunda passagem (revisão do Codex)

- **Data editorial** usa `editorialDay` (America/Sao_Paulo) em toda comparação; às 22h de São Paulo o dia
  de hoje não vence.
- **Criação do material é exclusiva** (`createDocOnce`/`createSetOnce`, `upsert: false`; `exclusive.ts`):
  quem perde a corrida reaproveita o material do vencedor. Erro de rede ou permissão sobe, não vira
  "não existe". Limite: a lista da pasta (`index.json`) segue lida e regravada sem trava, como em toda
  gravação; duas indexações simultâneas podem perder uma linha da lista (o arquivo não se perde).
  O Storage trata 400 como "não encontrado" na leitura (comportamento antigo): a gravação exclusiva é
  o que protege contra sobrescrever.
- **Criativos de um conteúdo** herdam o briefing no "Gerar com IA" e na conversa de edição, sem cases da
  Avence; conjuntos sem origem seguem como antes.
- **Resposta das funções** passa por `unwrapRow` (aceita objeto ou lista de uma linha e confere os campos).
- **Logs imutáveis** (`crm_account_context_versions.saved_by`, `crm_content_snapshots.created_by`) guardam
  o UUID sem chave para `auth.users`, para a exclusão de um usuário não colidir com o trigger.
- **Detalhe do conteúdo**: trocar de estado e trazer o texto do Copy exigem salvar ou descartar antes;
  respostas de leituras e ações do id anterior são ignoradas.

## Testes

`npm test` (arquivo `scripts/tests/superelements-v2.test.mjs`): transições, quem aprova, invalidação,
briefing, comparação do Copy, pendências do Início e as garantias da migração (RLS só de leitura,
security definer com `search_path`, `revoke` de `anon`/público, módulo e papel, imutabilidade, chaves
compostas, sem Realtime).

## Teste transacional do banco

`npm run db:query -- --file scripts/tests/superelements-v2.database.sql` verifica as regras com fixtures fictícios e rollback: contexto versionado, aprovação, edição concorrente, isolamento entre contas, módulo desligado, conta pausada, acesso anônimo e histórico imutável após remoção de gestor. O script exige a migração aplicada e não deixa dados de teste.

Reconstrua o conector com `npm run conector` ao publicar estas alterações; o conector distribuído deve acompanhar os novos pedidos de edição com briefing.
