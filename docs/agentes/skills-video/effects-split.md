---
name: effects-split
description: Tela dividida em Remotion: motion ilustrativo em cima sincronizado com a fala, pessoa embaixo, legenda no meio. Use em /effects-split.
---

# Effects Split

Tela dividida em Remotion: motion ilustrativo em cima sincronizado com a fala, pessoa embaixo, legenda no meio. Saída: MP4 1080×1920, 30 fps, com o áudio original.

## Uso

```
/effects-split [opções]
```

Precisa de: vídeo (+ .srt opcional). Se faltar, peça (uma pergunta só).

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

## Efeito (motion em cima, pessoa embaixo, legenda no meio)

Layout 1080×1920:
- Em cima (0–900): painel de motion, fundo `#0F1412` com grade sutil (linhas `#1B2420` a cada 48px) e vinheta.
- Embaixo (900–1920): `base.mp4` com `objectFit: 'cover'` e `objectPosition` ajustado para o rosto ficar no terço superior do painel (confira num still).
- Legenda centralizada na emenda (y ≈ 900), sobrepondo as duas metades: 2–4 palavras por vez, Inter 800 caixa alta ~64px, branca com sombra forte, palavra falada no momento em verde-menta `#7FD1B0`.
- Divisória: linha de 2px `#7FD1B0` com 40% de opacidade.

Motion ("bem ilustrativo"): cada IDEIA de `ideas.json` vira um visual. Não deixe mais de 1 s sem nada acontecendo no painel. Escolha por ideia:
- fluxo/processo ("grava, edita, publica") → ícones em quadrados arredondados ligados por linhas que se desenham
- número/resultado → número grande com contagem (só números falados)
- comparação/antes e depois → 2 colunas, uma riscada
- lista/passos → checklist que marca item por item
- conceito/ferramenta → ícone grande + texto curto (≤4 palavras)
- problema/erro → ícone com X e tremor

Estilo: ícones `lucide-react` brancos dentro de quadrados 160px, `borderRadius: 32`, gradiente terracota `#D0714F → #A9492E`, glow `0 0 40px rgba(208,113,79,0.45)`. Conectores verde-menta `#7FD1B0` desenhando com `strokeDashoffset`. Rótulos Inter 800 brancos.

Tempo: elemento entra 2 frames antes da palavra-chave (`spring` com `damping: 14` na escala 0.6 → 1 + opacidade), sai 6 frames antes da próxima ideia (escala → 0.9, opacidade → 0). Elementos de um mesmo visual entram em cascata de 4 frames.

---

## Problemas comuns

- Fonte errada no render: faltou `loadFont` de `@remotion/fonts` com o `.woff2` em `public/fonts`.
- Legenda fora de sincronia vinda de SRT: confirme que o SRT é do mesmo corte do vídeo (sem trechos removidos depois).
