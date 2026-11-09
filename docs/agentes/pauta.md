# Pauta: calendário editorial com aprovação do cliente (2026-11-05)

O usuário: "uma ferramenta estilo Pautta… organizar e aprovar uma série de criativos com o cliente… datas, horários, conteúdo de fácil acesso, aprovação e comentários… enviar pro cliente aprovar". Decisões dele: a IA ou o designer entrega ao gestor, o gestor aprova, depois o cliente aprova; o cliente só aprova e comenta, editar é da equipe.
- **Tela** `/pauta` (`src/pages/crm/Pauta.tsx`, menu "Pauta" ao lado de Conteúdos, módulo `copy`): calendário de mês e de semana sobre `crm_contents`; cada card mostra a capa do criativo ligado (`loadCovers`, uma leitura do `index.json` por pasta com `readSummaries`), horário, canal, comentários do cliente em aberto e a etapa (`stageOf` em `src/features/pauta/rules.ts`, sem `@/`: Ideia, Em produção, Com o gestor, Pronto para o cliente, Com o cliente, Cliente pediu ajuste, Aprovado pelo cliente). Arrastar muda o dia; a coluna "Sem data" recebe e solta. Painel da peça (`PautaPanel.tsx`): dia, horário, canal, o que o cliente viu (ou as capas antes do envio), a resposta dele, aviso quando texto ou criativo mudou depois do envio, e a conversa em duas abas ("Com o cliente" vai ao link; "Interno" nunca). Ao vivo pela Realtime (`crm_contents`, `crm_approval_items`, `crm_content_comments`).
- **Envio ao cliente** (só gestor, `SendDialog.tsx`, `sendToClient` em `src/features/pauta/api.ts`): só conteúdos aprovados pelo gestor; cada slide do criativo é desenhado em JPEG pelo `renderCreative` e sobe ao bucket público `crm-aprovacao/<conta>/<envio>/<conteúdo>/pN-sM.jpg` (só gestor grava); `crm_approval_create` grava o envio com a cópia do texto, data, legenda e hash do conjunto. O link `/pauta/aprovar/<id>` (`src/pages/PautaApproval.tsx`, sem login, 60 dias, revogável em "Envios") mostra cada peça com os slides, a legenda e o roteiro; o cliente aprova, pede ajuste (com o que mudar) ou comenta sobre um slide, com o nome que digitar; "Aprovar as N que faltam".
- **Banco** (migrações `20261105120000_crm_pauta.sql` e `20261105123000_crm_pauta_comentarios_antes.sql`, aplicadas): `crm_contents.scheduled_time`, `channel`, `client_status`, `client_at` (mudar o texto zera o estado do cliente, como já zera a aprovação do gestor); `crm_approval_links`, `crm_approval_items`, `crm_content_comments`; funções da equipe `crm_content_schedule`, `crm_approval_create`, `crm_approval_revoke`, `crm_content_comment(_resolve|_delete)`; públicas `crm_approval_get`, `crm_approval_respond`, `crm_approval_comment` (limite de 500 comentários do cliente por link). Testado em transação desfeita: bloqueios, ajuste sem nota, revogação, reset ao editar. Testes das regras em `scripts/tests/pauta.test.mjs`.
- Não feito: publicar/programar feed e carrossel a partir da Pauta (só stories e reels têm fila), aviso no WhatsApp quando o cliente responde, vídeo (motion) no link de aprovação (vai o slide parado).
- **Aprovar em um clique** (2026-11-05, o usuário: "nao consegui aprovar… quero que isso seja mais simples"): a Pauta tem a coluna **Ideias** (aprovar ou descartar na hora, "Gerar ideias com a Iara") e o painel da peça tem "Próximo passo" (Aprovar ideia, Aprovar, Enviar ao gestor, Pedir ajustes, Enviar ao cliente, Reabrir) e o texto (ideia e roteiro) editável ali. O gestor aprova direto de "em produção" (migração `20261105140000_crm_content_aprovar_direto.sql`, aplicada; continua exigindo roteiro). A diferença entre o Copy e o roteiro deixou de bloquear a aprovação: só avisa.

## Conteúdo como unidade e status únicos (2026-11-09, nova jornada de criação, Fase 2)

O usuário: "Pauta, conteúdo e texto é meio que a mesma coisa". O menu tem só "Pauta" (abas Calendário `/pauta`,
Lista `/conteudos`, Textos `/copy`).

- **Tela do conteúdo:** `ContentDetail.tsx` tem três abas (`?aba=`):
  - Texto: o roteiro, que é o texto oficial, o editor completo e o contexto da empresa.
  - Criativo e vídeo: Produzir com IA e o conjunto de Criativos.
  - Aprovação: a aprovação do gestor e o caminho para enviar ao cliente pela Pauta.
  - O link de voltar leva à Pauta.
- **Status:** um vocabulário só, o da Pauta.
  - `STATUS_LABEL` virou: Ideia, Em produção, Com o gestor, Aprovado pelo gestor.
  - `StatusChip` mostra a etapa inteira (`stageOf`), inclusive o que o cliente respondeu.
- **Roteiro sem cópia divergente:**
  - Ao abrir o editor completo, se o documento de Textos não foi mexido desde o último envio (hash igual a `linked_hash`), ele recebe o roteiro sozinho.
  - Só quando os dois mudaram a pessoa escolhe: "Usar o texto do editor" ou "Usar o roteiro daqui".
- **Radar da operação no Início** (Fase 3; o usuário: "pode ser sempre ativo… como um radar da operação mesmo, mostrando o que temos completo e o que falta"):
  - Componente `src/features/onboarding/OperationRadar.tsx`, com a regra em `journey.ts` (testada em `scripts/tests/primeiros-passos.test.mjs`).
  - Sempre à vista nas contas com o módulo copy. Não some e não fecha.
  - Cinco etapas, cada uma com o que está em dia e o que falta agora, em três estados: em dia, pede atenção ou falta.
    - Cérebro: visão geral e os 4 campos do Plano.
    - Marca: `brand_md` e padrões de post.
    - Pauta: conteúdos, os das próximas 2 semanas e os de data vencida.
    - Criativos: os em andamento sem criativo.
    - Aprovação: esperando o gestor, pedidos de ajuste do cliente, com o cliente, prontos para enviar.
  - As telas vazias de Pauta, Conteúdos e Criativos apontam para o Cérebro.
