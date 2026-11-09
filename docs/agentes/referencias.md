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
