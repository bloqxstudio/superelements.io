# Referências visuais da conta

**2026-11-09.** O usuário: "quero ter dentro do sistema uma aba pra referências, pra mandar links de vídeos do
Instagram e salvar como referência visual, para conseguir salvar as melhores e enviar pra ideias / produção de
criativos… as melhores refs pra aquela empresa, com os links de postagens, pode ser estáticos, vídeos, motion etc."

## Onde está

- **Tela:** `/referencias` (`src/pages/References.tsx`). Fica no menu em Criação, depois de Quadros, e só aparece
  para quem tem conta de empresa.
- **Dados:** `crm_references` (migração `20261109160000_crm_referencias.sql`, aplicada).
  - Uma linha por referência, por conta (RLS por `team_id`; testado: quem é de fora não vê).
  - Guarda: link, plataforma, tipo (estático, carrossel, vídeo, motion, Reels, story), nome, o que aproveitar,
    etiquetas, a estrela das melhores e a captura.
  - Um link salvo uma vez por conta.
- **Captura:** opcional. Fica no Cérebro da conta, pasta `referencias/` (`uploadFiles`), com link de 7 dias guardado
  no navegador (`mediaUrl`, regra de egress).
- **Regras:** `src/features/referencias/rules.ts` (`parseRefUrl`, `parseTags`, `referencesText`, `contentFormatOf`),
  testadas em `scripts/tests/referencias.test.mjs`. O acesso ao banco fica em `referencias/api.ts`.

## O que a tela faz

- **Ver o post:** pelo embed oficial da rede (Instagram `/p|reel/<código>/embed/`, YouTube, TikTok), só quando a
  pessoa clica em "Ver o post aqui".
  - Nada é baixado nem guardado do Instagram: a regra de nunca raspar continua (AGENTS.md).
  - Pinterest, Behance e sites não têm prévia; aparece a captura, se houver.
- **Ideia:** cria um conteúdo na Pauta (formato pelo tipo, com o link e o que aproveitar).
- **Criativo:** abre a Iara com o pedido de um criativo na linha da referência, na marca da conta, sem copiar
  texto, logo ou foto.
- **Estrela:** as referências marcadas (até 8) entram no contexto do Cérebro de toda criação (`accountContext`;
  área "Referências no contexto" em `CONNECTED_AREAS`).

## Não feito

- Testar a tela logada e o embed do Instagram no domínio publicado.
- Abrir o vídeo de um Reels para a IA analisar. A exceção que baixa um Reels pelo link vale só para o vídeo
  explicativo (`scripts/criativos/reel.ts`).

## Leitor do grupo do Instagram no Mac (2026-11-09)

O usuário: "temos um grupo no Instagram, enviamos lá as referências. Poderia ter um grupo pra cada projeto e enviar
nesse grupo e aí já criar tudo? Já deixar identificar, entender o que é cada criativo e tabular ele… pode usar a
conta pessoal… pode usar o Mac conectado". Ciente dos riscos, escolheu esse caminho em vez do grupo de WhatsApp
recomendado (`cerebro/iniciativas/superelements/decisoes.md`; exceção registrada no AGENTS.md).

- **Banco** (migração `20261109180000_crm_referencias_grupos.sql`, aplicada):
  - `crm_reference_sources`: os grupos de cada conta, com `thread_url` (`instagram.com/direct/t/<id>/`), a rotina
    (`every_minutes`, de 30 min a 1 dia), `run_requested_at` ("Ver novas agora"), a última volta e o erro.
  - `crm_references` ganha `source_id`, `author`, `caption`, `frames`, `auto` e `reviewed`.
- **Serviço** (`services/referencias`, Node com `playwright-core` e o Chrome do Mac):
  - **Perfil próprio:** `~/Library/Application Support/avence-referencias/perfil`, fora do git.
  - **Comandos:**
    - `npm run referencias -- entrar`: abre o Chrome para a pessoa entrar na conta. Faz-se uma vez, e de novo
      quando o Instagram sair.
    - `npm run referencias`: a rotina. A cada minuto olha os grupos que estão na hora.
    - `npm run referencias -- agora`: uma volta em todos os grupos.
    - `npm run referencias -- diagnostico <link do grupo>`: mostra os links achados sem gravar e salva uma
      captura da tela.
  - **Para rodar sempre:** `bash services/referencias/instalar-mac.sh`, que usa launchd e grava o log em
    `~/Library/Logs/avence-referencias.log`. A chave é a do serviço do WhatsApp (`services/whatsapp/.env.local`).
- **Uma volta:**
  1. Abre o grupo, sobe a conversa algumas telas e junta os links `/p/` e `/reel/`.
  2. Para cada post novo da conta (até 12): lê a página (autor e legenda pelo `og:description`, capa, se é vídeo,
     os slides do carrossel).
  3. Vídeo: baixa com o `yt-dlp` e os cookies num arquivo temporário apagado logo depois, e o `ffmpeg` tira até
     6 quadros. O vídeo é apagado.
  4. Sobe a capa e os quadros para o Cérebro (`referencias/<código>-capa.jpg`, `-q1`…).
  5. O Claude Code local (sonnet) devolve o tipo, o título, o que aproveitar e as etiquetas.
  6. Cria a referência como "Nova". Pausas de 4 a 9 s entre as páginas e de 15 a 30 s entre os grupos.
  7. Se o Instagram saiu da conta, o grupo mostra o erro, e a pessoa roda `entrar` de novo.
- **Tela:** "Grupos do Instagram" (cadastrar, rotina, ligar e desligar, "Ver novas agora", status e erro); o
  filtro "Novas do grupo"; e no cartão o selo "Nova", o @ de quem postou e o "Ok" para marcar como revisada.
- **Testes:** `services/referencias/tests/rules.test.mjs` (os links na conversa, o autor e a legenda, o tipo e a
  rotina).
- **Testado com um grupo real** (2026-11-09, grupo "Referencias 👀", cadastrado na conta Avence Studio):
  - **Como os posts aparecem:** um post compartilhado na DM é um cartão (`div[role=article]` com botão), sem link
    escrito.
  - **Como o leitor pega o endereço:** clica no cartão, lê o endereço `/p/<código>/` que a página abre e fecha
    com Esc.
  - **Para não clicar de novo:** guarda os cartões já abertos em
    `~/Library/Application Support/avence-referencias/cartoes-vistos.json`.
  - **Resultado:** importou 2 posts.
    - Um motion de `corretorja.oficial` e um Reels de `marcelodesignxh`, cada um com capa, 6 quadros, legenda,
      tipo, título, o que aproveitar e etiquetas.
    - O autor vem do `og:description`, que veio misturado ("usuario no November 9").
  - **Serviço sempre ligado:** instalado no launchd deste Mac (`com.avencestudio.referencias`).
  - **"Ver novas agora":** atendido em menos de 1 minuto, sem repetir os posts.

## Engajamento, ordem do grupo e importação em lote (2026-11-09)

O usuário pediu: "podemos ter o engajamento daquele vídeo? pra conseguir usar isso como um argumento e análise" e
"siga para mais 20, busque em lote, mas mostre a ordem enviada no grupo, mais recente em cima".

- **Banco** (migração `20261109190000_crm_referencias_engajamento.sql`, aplicada): `likes`, `comments`, `views`,
  `metrics_at` e `group_order`.
- **Engajamento:**
  - Curtidas e comentários vêm do `og:description`. Na leitura logada, a página do post não mostra as
    visualizações, e `views` fica vazio.
  - São os números do momento da leitura. `npm run referencias -- metricas [todas]` relê.
- **Lista virtual:** a conversa só tem na página os cartões visíveis. O leitor abre os cartões visíveis, rola
  para cima com a roda do mouse e repete. A primeira versão travava no topo, porque a lista cresce de baixo para
  cima.
- **Importar em lote:** `npm run referencias -- agora 40` lê os 40 posts mais recentes e importa os que faltam.
  A rotina continua abrindo no máximo 12 novos por volta.
- **Ordem do grupo:** cada leitura refaz a ordem de todos os posts que leu, na sequência exata da conversa
  (`windowOrders`, testada). Os mais antigos, fora daquela leitura, ficam abaixo. A tela ordena por ela ("Mais
  recentes no grupo") ou por "Mais engajamento".
- **Rolagem em passos de 600 px:** com passos de 1400 px, a roda pulava cartões entre um passo e outro. A releitura
  achou 9 posts que tinham ficado para trás.
- **Resultado em 2026-11-09:** 51 referências do grupo da Avence, 50 com curtidas e comentários, todas ordenadas.
- **Cartão e IA:** o cartão mostra curtidas e comentários. As referências com estrela levam o @ e o engajamento
  ao contexto da IA.

## Recriar a partir da referência (2026-11-09)

O usuário: "crie um fluxo pra recriar um criativo com base nessa referência, seja criar um vídeo ou post, podendo
por ex. criar com base num conteúdo novo, recriar como está".

- **Onde fica:** o botão "Recriar" no cartão abre `referencias/RecreateDialog.tsx`.
- **O que a pessoa escolhe:**
  - O que criar: post ou carrossel, ou vídeo (Reels).
  - Como: "Com um conteúdo novo" (o estilo da referência sobre outro assunto, que a pessoa escreve) ou "Recriar
    como está" (a mesma estrutura, sequência, ritmo e ideia, na voz e na marca da conta).
  - O conjunto de criativos da conta e, no post, o formato.
- **Como produz:** a capa e até 3 quadros da referência viram anexos da conversa (`registerAttachment`), e a Iara
  recebe o pedido pronto.
  - Post: `criar_de_referencia` (o designer reproduz o layout das imagens, na marca do conjunto).
  - Vídeo: `criar_video_explicativo`, com o roteiro e o estilo descritos a partir da referência.
- **O que nunca entra:** logo, nome, foto, rosto ou texto literal da outra empresa.
- **Não testado:** a criação real pelo app logado.

## Importar do grupo pela tela (2026-11-09)

O usuário: "temos novas referências no grupo, importe para o app na aba referências, podemos ter um fluxo por tela
pra isso? Pra clicar e fazer?".

- **Onde fica:** o botão "Importar do grupo" (em "Grupos do Instagram") e o "Importar" de cada grupo abrem
  `referencias/ImportDialog.tsx`. Substitui o antigo "Ver novas agora".
- **Os três passos:**
  1. Escolher o grupo (se houver mais de um) e quantos posts ler: só as novas (30 mais recentes, até 12 novas),
     20, 40 ou 60 mais recentes. Os já importados são pulados.
  2. Acompanhar: pedido enviado → lendo o grupo → importando N de M, com barra, a última classificada e o tempo
     que falta (~30 s por post). Confere o grupo a cada 4 s só com a janela aberta. Pode fechar; o Mac continua.
     Se o Mac não começar em 3 min, avisa para conferir o serviço `com.avencestudio.referencias`.
  3. Pronto: quantas chegaram e a lista; "Revisar as novas" fecha e liga o filtro "Novas do grupo".
- **Banco** (migração `20261109200000_crm_referencias_importar.sql`, aplicada): `run_limit`, `run_stage`
  (`lendo`, `importando`, `pronto`, `erro`), `run_started_at`, `run_total`, `run_done`, `run_note`.
- **Serviço:** com um pedido pendente e `run_limit`, lê os N mais recentes e importa os que faltam (até 60);
  escreve o andamento a cada etapa e a cada post, e limpa `run_limit` no fim. Reiniciar o launchd depois de mudar
  o `main.ts`: `launchctl kickstart -k gui/$(id -u)/com.avencestudio.referencias`.

## Conferir o grupo contra o app (2026-11-09)

O usuário: "temos alguns vídeos que não foram importados junto com o pacote, conseguimos ver isso? e pegar os
corretos?".

- **Comando:** `npm run referencias -- conferir [60] [corrigir]`.
  - Lê os N posts mais recentes do grupo e lista os que não estão no app e as referências sem quadros.
  - Das sem quadros, só trata como vídeo as em que o `yt-dlp` acha um vídeo.
  - Com `corrigir`, importa as que faltam e refaz as que são vídeo (tipo, quadros e classificação; nome e o que
    aproveitar só mudam se a equipe ainda não revisou).
  - Pausar o serviço antes (`launchctl bootout gui/$(id -u)/com.avencestudio.referencias`; voltar com
    `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.avencestudio.referencias.plist`), porque os dois
    usam o mesmo perfil do Chrome e o segundo não abre.
- **Detecção de vídeo:** antes só baixava o vídeo quando a página tinha um `<video>`, que nem sempre carrega a
  tempo. Agora o `yt-dlp` tenta sempre; num post só de imagem ele falha logo. Num vídeo, a capa vem primeiro e
  depois os quadros.
- **Resultado da primeira conferência:**
  - Faltavam 2 posts do grupo, os dois vídeos, que a lista virtual tinha pulado: `DfegiIoz7Rh` (Reels 3D) e
    `Deg8lIUMuA8` (motion). Importados com os quadros.
  - Nenhuma referência importada era vídeo sem quadros.
  - `DfiDBNriT9f` estava como Reels, mas é um carrossel de 8 imagens: corrigido à mão para carrossel.
  - Total: 63 referências do grupo.

## Extensão do Chrome para o Behance: feita e retirada (2026-11-09)

- **O pedido:** "vamos fazer um motor para buscar referências do Behance para o projeto e organizar no app".
- **O que foi feito:**
  - O Behance bloqueia robôs (403), então a busca automática ficou de fora.
  - Foi feita uma extensão do Chrome que salvava a página aberta, com uma função `referencias-salvar` e uma chave
    própria (migração `20261109210000`).
- **A retirada:**
  - Depois de testar, o usuário: "retire a feature, não ficou legal, não vamos usar".
  - Tudo foi retirado: o código, a função apagada no Supabase e a migração `20261109220000`, que desfaz a
    `20261109210000` (as duas ficam no histórico).
  - As 2 referências do Behance salvas no teste ficaram na conta Avence como referências comuns.
- **Para agentes:** não refazer sem um pedido novo.

## Leitor travado e lento depois de cadastrar o grupo de novo (2026-11-09)

O usuário: "estou tentando usar o motor de importar criativos e não está funcionando" e "antes tava bem rápido,
agora tá demorando muito".

- **Causas:**
  - O grupo foi tirado e cadastrado de novo (agora "refs", na Avence), com outro id.
  - O cache dos cartões abertos (`cartoes-vistos.json`) era guardado pelo id. Com o id novo, o leitor reabria
    todos os cartões e, sem chegar aos 30 posts, subia a conversa inteira. A tela ficava em "Lendo o grupo…".
  - A sessão logada ficou lenta (páginas estourando 60 s, com a rede normal), depois de mais de 70 posts lidos
    no dia: o Instagram segurando a conta.
- **Mudanças em `services/referencias/src/main.ts`:**
  - **Cache:** guardado pelo endereço do grupo. A primeira leitura junta as chaves antigas cujos posts já estão
    no app. Cada cartão é gravado logo depois de aberto.
  - **"Só as novas" e a rotina:** param em 3 posts seguidos que já estão no app (`KNOWN_RUN`). As opções de
    20, 40 e 60 leem a quantidade pedida.
  - **Leitura do grupo:** no máximo 6 minutos (`READ_BUDGET_MS`).
  - **Esperas:** o cartão espera o post abrir (`waitForURL`), em vez de 2 a 3,5 s fixos. Ao sair da conversa, o
    leitor usa o "voltar" do navegador antes de recarregar o grupo.
  - **Segunda tentativa:** abrir o grupo ou um post que estoura o tempo é tentado mais uma vez.
  - **Em fila:** o navegador lê o post seguinte enquanto o anterior baixa o vídeo, passa pela IA e é gravado
    (`startImport` / `finishImport`). As pausas entre posts ficaram iguais.
  - **Log:** cada cartão aberto (novo, já no app ou sem endereço) e um resumo da leitura com o motivo de parar.
- **Resultado:** a volta das 20:12 leu 11 posts em 331 s e parou nos que já estavam no app. Importou 4. Dois
  (`DfKmV_ZP-Ss`, `DfiP3SPCByW`) estouraram o tempo e ficaram para a próxima rotina.
- **Não testado:** a fila e as esperas novas (o serviço foi reiniciado com elas às 20:24, sem volta ainda).

## Grupo da Vizor importado pela metade (2026-11-11)

O usuário: "usei a importação de referências do grupo do instagram e retornou só algumas, não todas".

- **O que havia no grupo:** 11 posts e uma mensagem "Mensagem não aceita — use o app do Instagram para celular",
  que o Instagram web não mostra (o leitor não consegue lê-la).
- **O leitor achou só 3.** Dois defeitos em `readThread` (`services/referencias/src/main.ts`):
  - O cartão era marcado como visto antes de conferir a posição. Um cartão com o topo fora da área lida (y < 60)
    nunca era aberto, nem depois de a rolagem trazê-lo para a tela. Agora só é marcado quando abre.
  - A assinatura do cartão usava a primeira imagem, que é a foto de perfil do autor. Dois Reels do mesmo perfil
    tinham a mesma assinatura, e o segundo recebia o endereço do primeiro. Agora usa a maior imagem do cartão.
  - As assinaturas antigas em `cartoes-vistos.json` deixam de valer; a primeira volta reabre os cartões até chegar
    a 3 que já estão no app.
- **Cadastro em duas contas:** o mesmo grupo (`direct/t/2572820396515864`) estava cadastrado na **Sinfy** ("Refs",
  com as 3 primeiras importadas) e foi cadastrado de novo na **Vizor Películas** ("refs"). A volta na Vizor, com o
  leitor corrigido, importou os 11. As 3 da Sinfy continuam lá, sem grupo (`source_id` nulo), com o cadastro "Refs".
- **Não feito:** conferir o grupo da Avence com o leitor corrigido (`conferir 60`), que pode ter pulado posts
  pelo mesmo motivo.
