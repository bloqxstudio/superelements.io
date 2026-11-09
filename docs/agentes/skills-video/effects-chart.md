---
name: effects-chart
description: Pessoa num painel embaixo com topo em arco e gráficos, números e textos animados em cima conforme a fala, em Remotion. Use em /effects-chart.
---

# Effects Chart

Pessoa num painel embaixo com topo em arco e gráficos, números e textos animados em cima conforme a fala, em Remotion. Saída: MP4 1080×1920, 30 fps, com o áudio original.

## Uso

```
/effects-chart [opções]
```

Precisa de: vídeo (+ .srt opcional; números só os falados ou enviados). Se faltar, peça (uma pergunta só).

Opções em texto livre: cor de destaque, trecho do vídeo (ex.: "só de 0 a 5s"), duração do efeito, fonte.

## Regras gerais

- Fale em português, curto. Não explique o processo; entregue o vídeo.
- Nunca invente números, dados ou nomes que a pessoa não falou. Gráfico só com números da fala ou fornecidos pelo usuário. Sem número, use texto/ícone/lista.
- Sincronia é o que vende o efeito: todo elemento entra 2 frames ANTES da palavra correspondente e sai antes da próxima ideia.
- Máximo de 4 palavras na tela por elemento de motion (legenda não conta).
- Rosto nunca fica coberto por card ou texto na frente.
- Antes do render final, sempre conferir stills (passo 4).

## Pipeline

### 1. Preparar o vídeo

```bash
ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json input.mp4
# normaliza para 1080x1920 @ 30fps (frames passam a bater 1:1 com a composição)
ffmpeg -y -i input.mp4 -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -crf 16 -preset veryfast -c:a aac -b:a 192k base.mp4
```
Se o vídeo for horizontal, o crop centraliza; extraia um frame (`ffmpeg -ss 1 -i base.mp4 -frames:v 1 frame.png`), olhe e ajuste o crop para centralizar o rosto.

`durationInFrames = Math.round(duracao_segundos * 30)`.

### 2. Transcrever (timestamps por palavra)

Ordem de preferência:
1. `.srt` enviado pelo usuário. SRT só tem tempo por bloco: distribua as palavras dentro de cada bloco proporcionalmente ao número de letras.
2. Whisper local:
   ```bash
   pip install -U openai-whisper   # em sandbox: --break-system-packages
   whisper base.mp4 --model small --language pt --word_timestamps True --output_format json --output_dir transcript
   ```
3. Se o download do modelo falhar (rede bloqueada), peça o `.srt` ao usuário (CapCut, Premiere e YouTube exportam).

Salve em `src/data/words.json` no formato `[{"text":"Para","start":0.12,"end":0.31}, ...]` (segundos). Converta com `Math.round(s*30)`.

Depois agrupe em IDEIAS (blocos de 1,5–4 s, quebrando em pausa > 0,35 s ou fim de frase). Salve em `src/data/ideas.json`: `[{"start":0.1,"end":2.3,"text":"...","key":"palavra-chave","keyStart":0.9}]`.

### 3. Projeto Remotion

```bash
mkdir efeito && cd efeito && npm init -y
npm i remotion @remotion/cli @remotion/fonts react react-dom lucide-react
npm i -D typescript @types/react
mkdir -p public src/data && cp ../base.mp4 public/
```
Todos os pacotes `remotion` e `@remotion/*` na MESMA versão.

Fontes: instale via npm (`@fontsource/anton`, `@fontsource/inter`, `@fontsource/instrument-serif`, `@fontsource/archivo-black`), copie o `.woff2` de `node_modules/@fontsource/<fonte>/files/` para `public/fonts/` e carregue com `loadFont` de `@remotion/fonts` (ele espera a fonte antes de renderizar).

`src/index.ts` → `registerRoot(Root)`. `src/Root.tsx` registra `<Composition id="Efeito" width={1080} height={1920} fps={30} durationInFrames={N} component={Efeito} />`.

### 4. Conferir antes do render

```bash
npx remotion still src/index.ts Efeito out/check_1.png --frame=<F>
```
Gere 3–4 stills nos momentos-chave (entrada, pico, keyword, saída), abra e olhe: rosto livre, texto legível, borda do recorte limpa. Corrija e só então renderize.

### 5. Render e entrega

```bash
npx remotion render src/index.ts Efeito out/video.mp4 --codec h264 --crf 18
```
Se o download do Chrome Headless falhar, use `--browser-executable=$(which chromium || which google-chrome)`.

Entregue o MP4 com uma linha de contexto. Nada de recap do processo.

---

## Efeito (gráficos e textos em cima, pessoa no painel de baixo)

Visual de referência: fundo papel creme com grade, título preto com palavra em itálico serifado sublinhada, barras terracota com destaque amarelo.

Layout:
- Fundo inteiro `#F3EEE6` com grade `#E4DDD2` a cada 44px.
- Painel da pessoa: de y ≈ 920 até o fim, margem lateral 24px, topo em arco: `borderRadius: '50% 50% 0 0 / 150px 150px 0 0'`, `overflow: hidden`. Dentro, `base.mp4` com `objectFit: 'cover'` e `objectPosition` ajustado para o topo da cabeça ficar CORTADO pelo arco (como na referência). Não precisa de recorte de pessoa neste modo.
- Área de conteúdo: y 80–860, margens 48px.

Conteúdo guiado pela fala (cada IDEIA vira uma tela):
- números/ranking/comparação de valores → gráfico de barras: barras `#C9573C`, a maior em `#F0C36D`, valor em cima de cada barra (Anton, contagem), rótulo embaixo (Inter 700), linha de média tracejada `#D2453A` se fizer sentido. Barras sobem com `spring` em cascata de 4 frames.
- número único → número gigante (Anton ~260px) com contagem + rótulo curto
- afirmação/conceito → título grande (Archivo Black ~96px, `#1C1C1C`) com a palavra-chave em Instrument Serif Italic terracota e sublinhado vermelho que se desenha
- lista/passos → itens que entram um a um com marcador
- antes e depois → 2 colunas, a "antes" riscada
- ferramenta/objeto → ícone `lucide-react` grande em círculo + texto ≤4 palavras

Título fixo opcional no topo (ex.: tema do vídeo) se a fala tiver um tema único.

Transição entre telas: saída 6 frames (opacidade → 0, y −20), entrada 8 frames (opacidade 0 → 1, y 30 → 0), elementos em cascata. Entrada 2 frames antes da palavra-chave.

Números: só os falados ou fornecidos. Se a ideia não tiver número, NÃO faça gráfico; use título, lista ou ícone.

---

## Problemas comuns

- Fonte errada no render: faltou `loadFont` de `@remotion/fonts` com o `.woff2` em `public/fonts`.
- Legenda fora de sincronia vinda de SRT: confirme que o SRT é do mesmo corte do vídeo (sem trechos removidos depois).
