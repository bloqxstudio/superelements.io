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

## Inteligência de Instagram (instagram-agent-skill em português, 2026-11-09)

O usuário, com o link `github.com/Jakeschincariol/instagram-agent-skill` (13 skills, MIT): "quero que traga todas as skills e encaixar nas nossas, mas ter essa inteligência completa… e conseguimos fazer ler e comentar?".

- **Núcleo sem IA** (`src/features/instagram-ia/`, sem imports `@/` exceto os dois componentes; testes em `scripts/tests/instagram-ia.test.mjs`): os 6 scripts Python reescritos em TypeScript e o conteúdo refeito para o português. `ganchos.ts` (26 fórmulas com modelo, exemplo, texto da tela, para que serve, armadilha e o regex que reconhece a fórmula; a nota do gancho em 5 propriedades: tamanho, concreto com R$ e número por extenso, tensão, o forte na frente, fala com alguém; problemas graves: saudação, "pare de rolar", "neste vídeo", emoji, hashtag), `tempos.ts` (roteiro em minutagem a 160 palavras/min: gancho acima de 3 s, batida acima de 4 s, três batidas sem nada concreto, loop, alvo), `legenda.ts` (o que o feed mostra antes do "mais", primeira linha, uma chamada, até 5 hashtags, links mortos, emoji, termos de busca), `humanizar.ts` (invisíveis, travessão, aspas curvas, léxico de clichês em português e as estruturas a reescrever; 5 checagens com a nota antes e depois; palavras comuns com sentido literal, como jornada, norte, mergulhar, incrível, ficaram de fora do léxico), `virais.ts` (múltiplo sobre a mediana do próprio perfil, fórmula, terço de cima × de baixo, confiança; Markdown para o Cérebro), `auditoria.ts` (os posts reais da conta: múltiplo sobre a mediana do mesmo formato, envios, salvos e seguidores a cada mil de alcance, tempo assistido; achados com confiança; o gancho é a 1ª linha da legenda, porque a Meta não entrega o falado nem a retenção aos 3 s), `perfil.ts` (a rubrica de 12 itens / 100 pontos, que complementa `crm/profileAudit.ts`).
- **Ações da Iara** (`src/features/iara/instagramActions.ts`, em `allActions`; passos em `scripts/iara/labels.ts`): `ig_formulas`, `ig_ganchos`, `ig_tempos`, `ig_legenda_revisar`, `ig_humanizar`, `ig_virais` ("salvar" grava `instagram/virais.md` no Cérebro), `ig_o_que_funcionou`, `ig_perfil`, `ig_comentarios` (lê os comentários da conta conectada pela API oficial) e `ig_responder` (responde comentários da própria conta; `risky`, só sai com a confirmação da pessoa). A persona da Iara (`engine.ts`) manda usar as ferramentas e humanizar todo texto de Instagram.
- **Skills do chat** (`src/features/space/chat/instagramSkills.ts`, somadas a `CHAT_SKILLS`; ícones em `skills/skillIcon.ts`): as 13 em português (Reels, Virais do nicho, Legenda, Carrossel, Stories, Perfil, Semana, Humanizar, Comentar, Responder comentários, Direct, Reaproveitar, O que funcionou) mais **Voz da conta** (o `voice.md` deles). Os arquivos `~/.claude/instagram/*.md` viraram notas do Cérebro da conta: `instagram/voz.md`, `virais.md`, `registro.md`, `semana.md`; o carrossel sai pelos Criativos, a semana vai para a Pauta (`criar_ideias`).
- **Telas**: `CaptionCheck.tsx` embaixo da legenda em CRM › Instagram › Publicar, no Motion e na publicação da cena (o que o feed mostra, as checagens, "Cara de IA" e o botão "Tirar cara de IA"); o contador do Publicar passou a x/5 hashtags (o bloqueio de envio continua acima de 30, o limite que o app já tinha; acima de 5 a revisão marca "Corrigir"). `WhatWorked.tsx` na Análise (`?aba=analise`): "O que funcionou" em 30/90/180 dias, com "Pedir à Iara". A legenda escrita por IA (`criativos/captionAi.ts`) ganhou as regras (uma chamada, até 5 hashtags, sem link, sem travessão) e sai pelo humanizador.
- **Ler e comentar**: na conta conectada, ler e responder comentários (com confirmação) funciona pela API oficial. Em perfil de outra pessoa, nada automatizado: a API da Meta não comenta em post de outra conta e a regra do projeto proíbe; as skills Comentar e Direct entregam o texto para a pessoa colar. Ler posts de outros perfis continua só pela tela Referências (leitor do Mac, grupos de direct cadastrados) e pelo que a pessoa colar; o Business Discovery da Meta (números públicos de contas profissionais) exige o login do Instagram pelo Facebook, que o app não usa, e não foi feito.
- **Testado**: `npm test` (11 testes novos: as 26 fórmulas reconhecem o próprio exemplo, ganchos, tempos, legenda, humanizador, detector, virais, auditoria, rubrica, skills citando só ações que existem). **Não testado com login real**: as ações na aba logada, os comentários e respostas na Meta, as telas novas.

## Testes de reels / trial reels (2026-11-09)

O usuário: "crie o motor para trial reel pela plataforma, quero postar esse formato de conteúdo e validar vídeos
antes de levar para conta real". Pela API oficial (`trial_params` no contêiner `REELS`, changelog da Meta de
03/12/2025, todas as versões), o vídeo sai só para quem não segue a conta.

- **Publicar como teste:** chave `TrialOption` (`src/features/crm/TrialOption.tsx`) em CRM › Instagram › Publicar
  (reels ou vídeo único), no `MotionPublish` (só "Publicar agora": a fila programada não leva o teste), na cena em
  código (`ScenePublish`) e no vídeo explicativo. Estratégias: `MANUAL` ("Eu decido": a pessoa leva aos seguidores
  no app) e `SS_PERFORMANCE` (o Instagram leva sozinho se for bem). Com teste, `share_to_feed` não vai.
- **Banco:** `crm_instagram_trials` (migração `20261109230000_crm_instagram_trials.sql`, aplicada): o contêiner, o
  post, a estratégia, a duração do vídeo, os números da última leitura e os retratos de 24 h e 72 h. Só a função grava
  os números; a equipe atualiza só `decision`/`note`; quem publicou ou gestor apaga; barrada com o módulo desligado.
- **Função `instagram` v21:** `publish` aceita `trial: { strategy, title, duration }` e cria a linha; `finish` liga a
  linha ao post publicado (ou marca `falhou`); `readTrials` relê os testes no ar dos últimos 30 dias (um pedido de
  insights por teste) e roda no fim de cada `sync` (o cron de ~1 h) e pela ação `trials_read` ("Atualizar números").
- **Motor** (`src/features/crm/trialReels.ts`, testes em `scripts/tests/trial-reels.test.mjs`): retenção (tempo médio
  ÷ duração, ref. 40%, peso 35), compartilhamentos+salvos por mil visualizações (peso 30), interações por alcance
  (70% da mediana dos reels normais, peso 20) e visualizações (metade da mediana, peso 15); sem 3 reels normais usa
  referências fixas. Antes de 24 h ou com menos de 100 visualizações: "Rodando". Nota ≥ 70: "Levar aos seguidores";
  < 45 depois de 72 h: "Refazer", com o ponto fraco; no meio: "Esperar".
- **Tela:** CRM › Instagram › **Testes** (`?aba=testes`, `InstagramTrials.tsx`): resumo, cartão de cada teste com os
  sinais, 24 h × 72 h × agora, e as decisões "Levei aos seguidores", "Refazer", "Arquivar".
- **Limites da Meta:** a API não diz se o teste já foi levado aos seguidores nem permite levar por ela; a decisão
  aqui é registrada pela equipe. A elegibilidade da conta para trial reels é decidida pelo Instagram. **Ainda não
  testado com uma publicação real** (nenhum teste foi publicado nesta sessão).
