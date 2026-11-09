# Instagram e Meta

## Link para o cliente conectar o Instagram (2026-11-04)

O usuário: "mandar o link para o meu cliente conectar o Instagram dele… um link direto que ele vai abrir e autorizar, talvez nem precise de login". Em CRM › Instagram, na tela de conectar (da conta aberta), o gestor clica em "Gerar link para o cliente" (`ClientLink` em `src/pages/crm/Instagram.tsx`): copiar, copiar com mensagem ou mandar no WhatsApp. O link `/conectar/instagram/<segredo>` (`src/pages/ConnectInstagram.tsx`, pública, sem login) vale 7 dias e uma vez só; o cliente toca em "Conectar o Instagram", autoriza na tela oficial e volta para `/instagram/retorno`, que, com o segredo no sessionStorage (`LINK_KEY`), conclui sem login (`ConnectInstagramReturn`); a conta entra na equipe do link com `connected_by` = quem criou. Migração `20261104150000_crm_instagram_connect_links.sql` (aplicada): só o hash do segredo, a equipe lê, ninguém grava pela API (só a função). Função `instagram` v15: ações públicas `link_info`, `link_auth_url`, `link_connect` (o estado assinado leva `link:<id>`; o link é marcado como usado antes de trocar o código e volta a valer se a conexão falha) e, para gestores, `link_create` e `link_revoke`. Testado contra a função publicada com um link de teste (apagado): leitura, endereço de login e retorno falso recusado; a página aberta no navegador. **Limite da Meta**: com o app não publicado, só contas testadoras do app autorizam (convite em developers.facebook.com › o app › Funções do app › Testadores do Instagram, aceito no Instagram da pessoa em Configurações › Apps e sites › Convites de testador); "qualquer conta" só depois da verificação da empresa e do App Review (`META-PRODUCAO.md`).

## Análise de perfil do Instagram (2026-11-02)

O usuário: "uma ferramenta de analise de perfil, com base no perfil conectado, analisando bio, foto, destaques, postagens etc". CRM › Instagram › **Análise** (`?aba=analise`, `src/features/crm/InstagramAnalysis.tsx`). As checagens sem IA (`profileAudit.ts`, sem imports `@/`, testes em `scripts/tests/instagram-analise.test.mjs`) rodam na hora sobre o que a função `instagram` já guardou e dão nota de 0 a 100 a cada parte: bio e nome (vazia, curta, chamada, lugar, link, hashtags, emojis, Nome só com a marca), foto, destaques, ritmo (posts em 30/90 dias, último post, maior intervalo; stories só informam, porque a Meta só mostra os que estão no ar), formatos (mistura e alcance médio por formato em 90 dias), legendas (vazias, chamada, primeira linha, hashtags), desempenho (interações por alcance com referência de 3%, alcance por seguidor, salvos e compartilhamentos, alcance de não seguidores, saldo de seguidores) e dias e horários (só informa). Nota geral ponderada; partes sem dado ficam sem nota. **Destaques não vêm pela API da Meta**: a pessoa escreve os nomes (ou marca que não há), e eles vão com a análise e voltam da última. "Analisar com IA" usa a IA desta máquina (tarefa `perfil` em `porTarefa.ts`) pelo pedido `agent`, que agora aceita `images` (data URLs, até 12; `scripts/agente/run.ts`): a foto e os 9 últimos posts são baixados pelo pedido `download` e reduzidos no navegador; a resposta traz o diagnóstico, notas por área (foto, bio, destaques, grid, conteúdo, legendas), bio e nome sugeridos, destaques sugeridos e de 3 a 5 passos da semana (`profileAnalysis.ts`). Um conector antigo ignora as imagens e a análise diz que veio sem elas; o conector foi regerado (`npm run conector`). Cada análise salva fica em `crm_instagram_analyses` (migração `20261102140000_crm_instagram_analyses.sql`, aplicada; a equipe lê e grava, quem fez ou gestor apaga, barrada com o módulo Instagram desligado), com a nota, as partes, a leitura da IA, os destaques e o perfil daquele dia; a tela mostra a variação desde a última.

## Meta para contas de clientes (2026-10-28)

O usuário pediu produção na Meta e funcionamento para contas de clientes. Estado e próximos
passos em `META-PRODUCAO.md`. Função Instagram v11 e interface já publicadas (commit `97f8760`, deploy Hostinger
Completed/Current); o app publica pushes da main pelo GitHub. App Meta continua não publicado: faltam
verificação empresarial, acesso de provedor e App Review; cadastro público concluído. Verificação
empresarial parou na validação “Ajuda-nos a confirmar que és tu”. Textos de privacidade e exclusão aprovados pelo usuário, publicados e
cadastrados na Meta. A limpeza dos pedidos antigos do App Review aguarda autorização
específica após bloqueio da revisão automática; ver `META-PRODUCAO.md`. Não confundir autorização de testadores com acesso a clientes reais.
API de DMs ainda devolve vazio, mesmo com o escopo e testadores aceitos: não declarar
resolvido nem atribuir causa sem evidência. Preservar a separação de dados por conta.

Decisão explícita do usuário em 2026-10-28: **manter todos os pedidos do App Review**.
A retirada preparada foi cancelada na Meta. Não limpar solicitações legadas da revisão.

## Recebimento de DMs por webhook (2026-10-28)

A Caixa conserva a consulta periódica à API. O endpoint `instagram-webhook` também
recebe eventos `messages`: valida `X-Hub-Signature-256` sobre o corpo bruto com
`INSTAGRAM_APP_SECRET` ou `META_APP_SECRET`, e grava pelo RPC exclusivo de serviço
`crm_instagram_receive_dm` (migração `20261028172000_crm_instagram_webhook.sql`).
O RPC respeita o módulo Instagram da equipe, deduplica por mensagem, serializa
a conversa e não deixa evento antigo substituir a prévia recente. Testes em
`scripts/tests/instagram-webhook.test.mjs`. Não registrar conteúdo de DMs nem segredos.
Novas conexões com a permissão de mensagens assinam `subscribed_apps/messages`.
A conta avencestudio já teve essa assinatura confirmada pela Meta.
A URL é `https://nfmfcpcwyavutntnrxqq.supabase.co/functions/v1/instagram-webhook`.
O desafio GET exige `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` no Supabase. O token atual
do CLI não possui `edge_functions_secrets_write`: o segredo foi configurado pelo
painel do Supabase. Não colocar o token de verificação no Git. Callback cadastrado
e validado na Meta; o teste oficial de messages v26.0 retornou sucesso em 28/10
às 17:26. O parser aceita os envelopes messaging e changes/messages/value e
timestamps em milissegundos ou em segundos (inclusive texto).
Estado observado no painel da Meta: app não publicado, verificação da empresa
em análise e App Review não enviado. O painel informa que webhooks exigem app
publicado. Não afirmar funcionamento real antes de uma mensagem chegar pela Meta.

## Sincronização agendada no servidor (2026-11-09)

O usuário: "dados que demoram pra carregar e apresentam números errados… sinc… sempre em tempo real e com
dados reais, tanto dos anúncios quanto do Instagram". Antes, nada era lido da Meta em horário marcado: só
quando alguém abria a tela. O Início mostrava o que tinha ficado da última vez (a Vizor estava parada desde
06/11).

- **Cron** `crm-social-sync`, a cada 10 min, chama `public.crm_social_sync_tick()` (migração
  `20261109120000_crm_social_sync.sql`, aplicada):
  - **Instagram:** `instagram` com a ação `sync_account`, uma conta por chamada, a cada ~1 h. O limite de
    chamadas da Meta é por conta, e cada leitura completa faz dezenas delas.
  - **Anúncios:** `meta-ads` com a ação `cron_report`. Hoje é relido a cada ~15 min; 7 e 30 dias a cada ~1 h.
  - **Autorização:** usa o segredo e o endereço dos stories (Vault). O `meta-ads` mantém `verify_jwt`: o cron
    manda a chave anon no Authorization (segredo `supabase_anon_key` no Vault) e o `x-cron-secret`.
  - **Ficam de fora:** contas pausadas, com o módulo Instagram desligado ou com o token expirado.
  - **Primeiro ciclo:** 14 chamadas com código 200. Todas as contas foram relidas às 14:08.
- **Números corrigidos:**
  - **Anúncios:**
    - `use_unified_attribution_setting=true` em todas as leituras: a mesma atribuição do Gerenciador de
      Anúncios.
    - O resultado de cada dia sai do mesmo `results` da campanha, então o gráfico soma o total.
  - **Instagram:**
    - Os totais de 7 e 30 dias usam dias completos até ontem, no horário de São Paulo, como os anúncios. Antes
      a janela terminava na hora da leitura e misturava um pedaço de hoje.
    - As duas janelas são lidas em paralelo.
    - As métricas de reserva de Reels e Stories mantêm `views`.
- **Telas:**
  - Leem o que está salvo e só chamam a Meta quando o salvo passou do ciclo do servidor: Instagram 75 min,
    anúncios 70 min, hoje 20 min.
  - O menu pergunta o perfil a cada 30 min (antes 10 min, por navegador).
  - O Início não compara mais o "hoje" do navegador com o da conta de anúncios.
  - Os avisos de dado velho: 2 h para anúncios e 3 h para o Instagram.
- **Não feito:**
  - Realtime nas tabelas de relatório: o JSON é grande, e o egress conta. As telas releem a tabela.
  - Paginar além dos 50 posts mais recentes: os mais antigos ficam com o último número lido.
  - Prender o alcance diário ao dia de São Paulo: a Meta fecha o dia no horário do Pacífico.
